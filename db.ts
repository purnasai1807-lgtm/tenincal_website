// db.ts — Postgres-backed persistence layer.
//
// Replaces the previous in-memory arrays (users/events/registrations) so data
// survives restarts, redeploys, and (if ever moved back to a stateless
// platform like Vercel Functions) cold starts.
//
// Connection string comes from the POSTGRES_URL environment variable — never
// hardcode credentials here. Any standard Postgres provider works (Railway,
// Neon, Supabase, RDS, etc.). Railway's own Postgres plugin exposes its
// connection string as DATABASE_URL, which is used as a fallback below.
//
// Pool sizing: this app currently runs as a long-lived Node process (Railway
// service), so a small connection pool is safe. If this is ever deployed
// as a stateless serverless function again (Vercel/AWS Lambda), set
// PG_POOL_MAX=1 via env so each invocation doesn't open a new saturating
// connection — or switch to an HTTP-based driver such as
// @neondatabase/serverless.
import { Pool, type QueryResultRow } from 'pg';

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  email: string;
  role: 'admin' | 'user';
  rollNumber?: string;
  year?: string;
  section?: string;
  createdAt: string;
}

export interface StoredEvent {
  id: string;
  title: string;
  category: 'workshop' | 'hackathon' | 'bootcamp' | 'seminar';
  tagline: string;
  description: string;
  organizer: string;
  coOrganizer?: string;
  dates: string;
  venue: string;
  targetAudience: string;
  price: number;
  capacity: number;
  registeredCount: number;
  topics: string[];
  schedule: {
    day: string;
    title: string;
    time: string;
    description: string;
  }[];
  speakers: {
    name: string;
    role: string;
    organization: string;
    avatar: string;
  }[];
  isFlagship?: boolean;
  imageUrl?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface StoredRegistration {
  id: string;
  registrationId: string;
  fullName: string;
  emailEncrypted: string;
  phoneEncrypted: string;
  rollNumber: string;
  year: '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
  section: 'A' | 'B' | 'C' | 'D' | 'Other';
  eventId: string;
  eventTitle: string;
  ticketTier: string;
  ticketPrice: number;
  paymentStatus: 'free_confirmed' | 'paid' | 'pending';
  paymentIdEncrypted?: string;
  registeredAt: string;
  attended: boolean;
  checkInTime?: string;
  notes?: string;
  qrToken?: string;
}

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'POSTGRES_URL (or DATABASE_URL) is not set. Add a Postgres connection string as an environment variable — do not hardcode it in source.'
  );
}

const sslMode = process.env.PGSSL || 'require';

export const pool = new Pool({
  connectionString,
  max: Number.parseInt(process.env.PG_POOL_MAX || '5', 10),
  ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
});

async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

// --- Schema bootstrap (idempotent — safe to run on every startup) ---
export async function initDb(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      roll_number TEXT,
      year TEXT,
      section TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      tagline TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      organizer TEXT NOT NULL DEFAULT '',
      co_organizer TEXT,
      dates TEXT NOT NULL DEFAULT '',
      venue TEXT NOT NULL DEFAULT '',
      target_audience TEXT NOT NULL DEFAULT '',
      price NUMERIC NOT NULL DEFAULT 0,
      capacity INTEGER NOT NULL DEFAULT 100,
      registered_count INTEGER NOT NULL DEFAULT 0,
      topics JSONB NOT NULL DEFAULT '[]',
      schedule JSONB NOT NULL DEFAULT '[]',
      speakers JSONB NOT NULL DEFAULT '[]',
      is_flagship BOOLEAN NOT NULL DEFAULT false,
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT
    );
  `);
  await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;`);

  await query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      registration_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email_encrypted TEXT NOT NULL,
      phone_encrypted TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      year TEXT NOT NULL,
      section TEXT NOT NULL,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      event_title TEXT NOT NULL,
      ticket_tier TEXT NOT NULL,
      ticket_price NUMERIC NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL,
      payment_id_encrypted TEXT,
      registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      attended BOOLEAN NOT NULL DEFAULT false,
      check_in_time TIMESTAMPTZ,
      notes TEXT
    );
  `);
  await query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS qr_token TEXT;`);
  await query(`
    CREATE TABLE IF NOT EXISTS qr_scan_events (
      id BIGSERIAL PRIMARY KEY,
      registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_qr_scan_events_registration ON qr_scan_events(registration_id);`);

  await query(`CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);`);

  await query(`
    CREATE TABLE IF NOT EXISTS coding_tests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      questions JSONB NOT NULL DEFAULT '[]',
      total_marks INTEGER NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS test_submissions (
      id TEXT PRIMARY KEY,
      test_id TEXT NOT NULL REFERENCES coding_tests(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answers JSONB NOT NULL DEFAULT '[]',
      score INTEGER NOT NULL DEFAULT 0,
      total_marks INTEGER NOT NULL DEFAULT 0,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (test_id, user_id)
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_test_submissions_user ON test_submissions(user_id);`);

  await query(`
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'award',
      awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      awarded_by TEXT
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);`);

  await query(`
    CREATE TABLE IF NOT EXISTS certificate_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      image_data TEXT NOT NULL,
      name_x REAL NOT NULL DEFAULT 50,
      name_y REAL NOT NULL DEFAULT 50,
      font_size INTEGER NOT NULL DEFAULT 42,
      font_color TEXT NOT NULL DEFAULT '#1e293b',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS certificate_approvals (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES certificate_templates(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      note TEXT,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      approved_by TEXT,
      UNIQUE (template_id, user_id)
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_certificate_approvals_user ON certificate_approvals(user_id);`);
}

// --- Idempotent master admin seed (never overwrites an existing account) ---
export async function seedAdminIfMissing(admin: StoredUser): Promise<void> {
  const existing = await getUserByUsername(admin.username);
  if (existing) return;

  const existingByEmail = await getUserByEmail(admin.email);
  if (existingByEmail) return;

  await insertUser(admin);
}

// --- Row <-> domain object mapping ---
function rowToUser(row: any): StoredUser {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    rollNumber: row.roll_number ?? undefined,
    year: row.year ?? undefined,
    section: row.section ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function rowToEvent(row: any): StoredEvent {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    tagline: row.tagline,
    description: row.description,
    organizer: row.organizer,
    coOrganizer: row.co_organizer ?? undefined,
    dates: row.dates,
    venue: row.venue,
    targetAudience: row.target_audience,
    price: Number(row.price),
    capacity: Number(row.capacity),
    registeredCount: Number(row.registered_count),
    topics: row.topics ?? [],
    schedule: row.schedule ?? [],
    speakers: row.speakers ?? [],
    isFlagship: row.is_flagship,
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    createdBy: row.created_by ?? undefined,
  };
}

function rowToRegistration(row: any): StoredRegistration {
  return {
    id: row.id,
    registrationId: row.registration_id,
    fullName: row.full_name,
    emailEncrypted: row.email_encrypted,
    phoneEncrypted: row.phone_encrypted,
    rollNumber: row.roll_number,
    year: row.year,
    section: row.section,
    eventId: row.event_id,
    eventTitle: row.event_title,
    ticketTier: row.ticket_tier,
    ticketPrice: Number(row.ticket_price),
    paymentStatus: row.payment_status,
    paymentIdEncrypted: row.payment_id_encrypted ?? undefined,
    registeredAt: new Date(row.registered_at).toISOString(),
    attended: row.attended,
    checkInTime: row.check_in_time ? new Date(row.check_in_time).toISOString() : undefined,
    notes: row.notes ?? undefined,
    qrToken: row.qr_token ?? undefined,
  };
}

// --- Users ---
export async function getUsers(): Promise<StoredUser[]> {
  const res = await query('SELECT * FROM users ORDER BY created_at ASC');
  return res.rows.map(rowToUser);
}

export async function getUserByUsername(username: string): Promise<StoredUser | undefined> {
  const res = await query('SELECT * FROM users WHERE lower(username) = lower($1) LIMIT 1', [username]);
  return res.rows[0] ? rowToUser(res.rows[0]) : undefined;
}

export async function getUserByEmail(email: string): Promise<StoredUser | undefined> {
  const res = await query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [email]);
  return res.rows[0] ? rowToUser(res.rows[0]) : undefined;
}

export async function getUserByUsernameOrEmail(identifier: string): Promise<StoredUser | undefined> {
  const res = await query(
    'SELECT * FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1) LIMIT 1',
    [identifier]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : undefined;
}

export async function insertUser(user: StoredUser): Promise<StoredUser> {
  await query(
    `INSERT INTO users (id, username, password_hash, full_name, email, role, roll_number, year, section, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      user.id,
      user.username,
      user.passwordHash,
      user.fullName,
      user.email,
      user.role,
      user.rollNumber ?? null,
      user.year ?? null,
      user.section ?? null,
      user.createdAt,
    ]
  );
  return user;
}

export async function updateUserProfile(
  id: string,
  patch: Partial<Pick<StoredUser, 'fullName' | 'year' | 'section'>>
): Promise<StoredUser | undefined> {
  const res = await query(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       year = COALESCE($3, year),
       section = COALESCE($4, section)
     WHERE id = $1
     RETURNING *`,
    [id, patch.fullName ?? null, patch.year ?? null, patch.section ?? null]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : undefined;
}

// --- Events ---
export async function getEvents(): Promise<StoredEvent[]> {
  const res = await query('SELECT * FROM events ORDER BY created_at DESC NULLS LAST');
  return res.rows.map(rowToEvent);
}

export async function getEventById(id: string): Promise<StoredEvent | undefined> {
  const res = await query('SELECT * FROM events WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] ? rowToEvent(res.rows[0]) : undefined;
}

export async function insertEvent(event: StoredEvent): Promise<StoredEvent> {
  await query(
    `INSERT INTO events (
       id, title, category, tagline, description, organizer, co_organizer, dates, venue,
       target_audience, price, capacity, registered_count, topics, schedule, speakers,
       is_flagship, image_url, created_at, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [
      event.id,
      event.title,
      event.category,
      event.tagline,
      event.description,
      event.organizer,
      event.coOrganizer ?? null,
      event.dates,
      event.venue,
      event.targetAudience,
      event.price,
      event.capacity,
      event.registeredCount,
      JSON.stringify(event.topics ?? []),
      JSON.stringify(event.schedule ?? []),
      JSON.stringify(event.speakers ?? []),
      Boolean(event.isFlagship),
      event.imageUrl ?? null,
      event.createdAt ?? new Date().toISOString(),
      event.createdBy ?? null,
    ]
  );
  return event;
}

export async function updateEvent(id: string, updated: StoredEvent): Promise<StoredEvent | undefined> {
  const res = await query(
    `UPDATE events SET
       title = $2, category = $3, tagline = $4, description = $5, organizer = $6,
       co_organizer = $7, dates = $8, venue = $9, target_audience = $10, price = $11,
       capacity = $12, topics = $13, schedule = $14, speakers = $15, is_flagship = $16, image_url = $17
     WHERE id = $1
     RETURNING *`,
    [
      id,
      updated.title,
      updated.category,
      updated.tagline,
      updated.description,
      updated.organizer,
      updated.coOrganizer ?? null,
      updated.dates,
      updated.venue,
      updated.targetAudience,
      updated.price,
      updated.capacity,
      JSON.stringify(updated.topics ?? []),
      JSON.stringify(updated.schedule ?? []),
      JSON.stringify(updated.speakers ?? []),
      Boolean(updated.isFlagship),
      updated.imageUrl ?? null,
    ]
  );
  return res.rows[0] ? rowToEvent(res.rows[0]) : undefined;
}

export async function deleteEvent(id: string): Promise<StoredEvent | undefined> {
  const res = await query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);
  return res.rows[0] ? rowToEvent(res.rows[0]) : undefined;
}

export async function incrementEventRegisteredCount(eventId: string): Promise<void> {
  await query('UPDATE events SET registered_count = registered_count + 1 WHERE id = $1', [eventId]);
}

// --- Registrations ---
export async function getRegistrations(): Promise<StoredRegistration[]> {
  const res = await query('SELECT * FROM registrations ORDER BY registered_at DESC');
  return res.rows.map(rowToRegistration);
}

export async function getRegistrationsByEvent(eventId: string): Promise<StoredRegistration[]> {
  const res = await query('SELECT * FROM registrations WHERE event_id = $1 ORDER BY registered_at DESC', [eventId]);
  return res.rows.map(rowToRegistration);
}

export async function getRegistrationById(idOrRegistrationId: string): Promise<StoredRegistration | undefined> {
  const res = await query(
    'SELECT * FROM registrations WHERE id = $1 OR registration_id = $1 LIMIT 1',
    [idOrRegistrationId]
  );
  return res.rows[0] ? rowToRegistration(res.rows[0]) : undefined;
}

export async function insertRegistration(reg: StoredRegistration): Promise<StoredRegistration> {
  await query(
    `INSERT INTO registrations (
       id, registration_id, full_name, email_encrypted, phone_encrypted, roll_number, year, section,
       event_id, event_title, ticket_tier, ticket_price, payment_status, payment_id_encrypted,
       registered_at, attended, check_in_time, notes, qr_token
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      reg.id,
      reg.registrationId,
      reg.fullName,
      reg.emailEncrypted,
      reg.phoneEncrypted,
      reg.rollNumber,
      reg.year,
      reg.section,
      reg.eventId,
      reg.eventTitle,
      reg.ticketTier,
      reg.ticketPrice,
      reg.paymentStatus,
      reg.paymentIdEncrypted ?? null,
      reg.registeredAt,
      reg.attended,
      reg.checkInTime ?? null,
      reg.notes ?? null,
      reg.qrToken ?? null,
    ]
  );
  return reg;
}

export async function updateRegistration(
  id: string,
  patch: Partial<Pick<StoredRegistration, 'attended' | 'checkInTime'>>
): Promise<StoredRegistration | undefined> {
  const res = await query(
    `UPDATE registrations SET
       attended = COALESCE($2, attended),
       check_in_time = $3
     WHERE id = $1 OR registration_id = $1
     RETURNING *`,
    [id, patch.attended ?? null, patch.checkInTime ?? null]
  );
  return res.rows[0] ? rowToRegistration(res.rows[0]) : undefined;
}

export async function markRegistrationCheckedIn(id: string, checkInTime: string): Promise<StoredRegistration | undefined> {
  const res = await query(
    `UPDATE registrations
     SET attended = true, check_in_time = $2
     WHERE (id = $1 OR registration_id = $1) AND attended = false
     RETURNING *`,
    [id, checkInTime]
  );
  return res.rows[0] ? rowToRegistration(res.rows[0]) : undefined;
}

export async function recordQrScan(registrationId: string, eventId: string, scannedAt: string): Promise<void> {
  await query(
    `INSERT INTO qr_scan_events (registration_id, event_id, scanned_at) VALUES ($1, $2, $3)`,
    [registrationId, eventId, scannedAt]
  );
}

export async function getQrScanSummary(): Promise<Map<string, { count: number; times: string[] }>> {
  const res = await query(
    `SELECT registration_id, COUNT(*)::int AS scan_count,
            ARRAY_AGG(scanned_at ORDER BY scanned_at) AS scan_times
     FROM qr_scan_events
     GROUP BY registration_id`
  );
  return new Map(res.rows.map((row: any) => [
    row.registration_id,
    {
      count: Number(row.scan_count),
      times: (row.scan_times || []).map((value: string | Date) => new Date(value).toISOString()),
    },
  ]));
}

export async function deleteRegistration(id: string): Promise<StoredRegistration | undefined> {
  const res = await query(
    'DELETE FROM registrations WHERE id = $1 OR registration_id = $1 RETURNING *',
    [id]
  );
  return res.rows[0] ? rowToRegistration(res.rows[0]) : undefined;
}

export async function deleteRegistrationsByEvent(eventId: string): Promise<number> {
  const res = await query('DELETE FROM registrations WHERE event_id = $1 RETURNING id', [eventId]);
  return res.rowCount ?? 0;
}

// --- Coding Tests, Submissions, Achievements & Certificates ---

export interface TestQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  marks: number;
}

export interface StoredCodingTest {
  id: string;
  title: string;
  description: string;
  eventId?: string;
  durationMinutes: number;
  questions: TestQuestion[];
  totalMarks: number;
  isPublished: boolean;
  createdAt: string;
  createdBy?: string;
}

export interface StoredTestSubmission {
  id: string;
  testId: string;
  userId: string;
  answers: number[];
  score: number;
  totalMarks: number;
  submittedAt: string;
}

export interface StoredAchievement {
  id: string;
  userId: string;
  title: string;
  description: string;
  icon: string;
  awardedAt: string;
  awardedBy?: string;
}

export interface StoredCertificateTemplate {
  id: string;
  name: string;
  eventId?: string;
  imageData: string;
  nameX: number;
  nameY: number;
  fontSize: number;
  fontColor: string;
  createdAt: string;
  createdBy?: string;
}

export interface StoredCertificateApproval {
  id: string;
  templateId: string;
  userId: string;
  eventId?: string;
  status: 'approved' | 'pending' | 'rejected';
  note?: string;
  approvedAt: string;
  approvedBy?: string;
}

function rowToCodingTest(row: any): StoredCodingTest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventId: row.event_id ?? undefined,
    durationMinutes: Number(row.duration_minutes),
    questions: row.questions ?? [],
    totalMarks: Number(row.total_marks),
    isPublished: row.is_published,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by ?? undefined,
  };
}

function rowToTestSubmission(row: any): StoredTestSubmission {
  return {
    id: row.id,
    testId: row.test_id,
    userId: row.user_id,
    answers: row.answers ?? [],
    score: Number(row.score),
    totalMarks: Number(row.total_marks),
    submittedAt: new Date(row.submitted_at).toISOString(),
  };
}

function rowToAchievement(row: any): StoredAchievement {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    awardedAt: new Date(row.awarded_at).toISOString(),
    awardedBy: row.awarded_by ?? undefined,
  };
}

function rowToCertificateTemplate(row: any): StoredCertificateTemplate {
  return {
    id: row.id,
    name: row.name,
    eventId: row.event_id ?? undefined,
    imageData: row.image_data,
    nameX: Number(row.name_x),
    nameY: Number(row.name_y),
    fontSize: Number(row.font_size),
    fontColor: row.font_color,
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by ?? undefined,
  };
}

function rowToCertificateApproval(row: any): StoredCertificateApproval {
  return {
    id: row.id,
    templateId: row.template_id,
    userId: row.user_id,
    eventId: row.event_id ?? undefined,
    status: row.status,
    note: row.note ?? undefined,
    approvedAt: new Date(row.approved_at).toISOString(),
    approvedBy: row.approved_by ?? undefined,
  };
}

// --- Coding Tests ---
export async function getCodingTests(publishedOnly = false): Promise<StoredCodingTest[]> {
  const res = publishedOnly
    ? await query('SELECT * FROM coding_tests WHERE is_published = true ORDER BY created_at DESC')
    : await query('SELECT * FROM coding_tests ORDER BY created_at DESC');
  return res.rows.map(rowToCodingTest);
}

export async function getCodingTestById(id: string): Promise<StoredCodingTest | undefined> {
  const res = await query('SELECT * FROM coding_tests WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] ? rowToCodingTest(res.rows[0]) : undefined;
}

export async function insertCodingTest(test: StoredCodingTest): Promise<StoredCodingTest> {
  await query(
    `INSERT INTO coding_tests (id, title, description, event_id, duration_minutes, questions, total_marks, is_published, created_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      test.id,
      test.title,
      test.description,
      test.eventId ?? null,
      test.durationMinutes,
      JSON.stringify(test.questions ?? []),
      test.totalMarks,
      test.isPublished,
      test.createdAt,
      test.createdBy ?? null,
    ]
  );
  return test;
}

export async function updateCodingTest(id: string, updated: StoredCodingTest): Promise<StoredCodingTest | undefined> {
  const res = await query(
    `UPDATE coding_tests SET
       title = $2, description = $3, event_id = $4, duration_minutes = $5,
       questions = $6, total_marks = $7, is_published = $8
     WHERE id = $1
     RETURNING *`,
    [
      id,
      updated.title,
      updated.description,
      updated.eventId ?? null,
      updated.durationMinutes,
      JSON.stringify(updated.questions ?? []),
      updated.totalMarks,
      updated.isPublished,
    ]
  );
  return res.rows[0] ? rowToCodingTest(res.rows[0]) : undefined;
}

export async function deleteCodingTest(id: string): Promise<StoredCodingTest | undefined> {
  const res = await query('DELETE FROM coding_tests WHERE id = $1 RETURNING *', [id]);
  return res.rows[0] ? rowToCodingTest(res.rows[0]) : undefined;
}

// --- Test Submissions ---
export async function getSubmissionsByTest(testId: string): Promise<StoredTestSubmission[]> {
  const res = await query('SELECT * FROM test_submissions WHERE test_id = $1 ORDER BY score DESC, submitted_at ASC', [testId]);
  return res.rows.map(rowToTestSubmission);
}

export async function getSubmissionsByUser(userId: string): Promise<StoredTestSubmission[]> {
  const res = await query('SELECT * FROM test_submissions WHERE user_id = $1 ORDER BY submitted_at DESC', [userId]);
  return res.rows.map(rowToTestSubmission);
}

export async function getSubmission(testId: string, userId: string): Promise<StoredTestSubmission | undefined> {
  const res = await query('SELECT * FROM test_submissions WHERE test_id = $1 AND user_id = $2 LIMIT 1', [testId, userId]);
  return res.rows[0] ? rowToTestSubmission(res.rows[0]) : undefined;
}

export async function insertTestSubmission(sub: StoredTestSubmission): Promise<StoredTestSubmission> {
  await query(
    `INSERT INTO test_submissions (id, test_id, user_id, answers, score, total_marks, submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [sub.id, sub.testId, sub.userId, JSON.stringify(sub.answers ?? []), sub.score, sub.totalMarks, sub.submittedAt]
  );
  return sub;
}

// --- Leaderboard: aggregate best score per user across all tests ---
export interface LeaderboardRow {
  userId: string;
  fullName: string;
  rollNumber?: string;
  totalScore: number;
  testsTaken: number;
  rank: number;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const res = await query(
    `SELECT
       u.id AS user_id,
       u.full_name,
       u.roll_number,
       COALESCE(SUM(s.score), 0) AS total_score,
       COUNT(s.id) AS tests_taken,
       RANK() OVER (ORDER BY COALESCE(SUM(s.score), 0) DESC) AS rank
     FROM users u
     LEFT JOIN test_submissions s ON s.user_id = u.id
     WHERE u.role = 'user'
     GROUP BY u.id, u.full_name, u.roll_number
     HAVING COUNT(s.id) > 0
     ORDER BY total_score DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows.map((row: any) => ({
    userId: row.user_id,
    fullName: row.full_name,
    rollNumber: row.roll_number ?? undefined,
    totalScore: Number(row.total_score),
    testsTaken: Number(row.tests_taken),
    rank: Number(row.rank),
  }));
}

export async function getLeaderboardRankForUser(userId: string): Promise<LeaderboardRow | undefined> {
  const all = await getLeaderboard(100000);
  return all.find((r) => r.userId === userId);
}

// --- Achievements ---
export async function getAchievementsByUser(userId: string): Promise<StoredAchievement[]> {
  const res = await query('SELECT * FROM achievements WHERE user_id = $1 ORDER BY awarded_at DESC', [userId]);
  return res.rows.map(rowToAchievement);
}

export async function insertAchievement(a: StoredAchievement): Promise<StoredAchievement> {
  await query(
    `INSERT INTO achievements (id, user_id, title, description, icon, awarded_at, awarded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [a.id, a.userId, a.title, a.description, a.icon, a.awardedAt, a.awardedBy ?? null]
  );
  return a;
}

export async function deleteAchievement(id: string): Promise<boolean> {
  const res = await query('DELETE FROM achievements WHERE id = $1 RETURNING id', [id]);
  return (res.rowCount ?? 0) > 0;
}

// --- Certificate Templates ---
export async function getCertificateTemplates(): Promise<StoredCertificateTemplate[]> {
  const res = await query('SELECT * FROM certificate_templates ORDER BY created_at DESC');
  return res.rows.map(rowToCertificateTemplate);
}

export async function getCertificateTemplateById(id: string): Promise<StoredCertificateTemplate | undefined> {
  const res = await query('SELECT * FROM certificate_templates WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] ? rowToCertificateTemplate(res.rows[0]) : undefined;
}

export async function insertCertificateTemplate(t: StoredCertificateTemplate): Promise<StoredCertificateTemplate> {
  await query(
    `INSERT INTO certificate_templates (id, name, event_id, image_data, name_x, name_y, font_size, font_color, created_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      t.id,
      t.name,
      t.eventId ?? null,
      t.imageData,
      t.nameX,
      t.nameY,
      t.fontSize,
      t.fontColor,
      t.createdAt,
      t.createdBy ?? null,
    ]
  );
  return t;
}

export async function deleteCertificateTemplate(id: string): Promise<boolean> {
  const res = await query('DELETE FROM certificate_templates WHERE id = $1 RETURNING id', [id]);
  return (res.rowCount ?? 0) > 0;
}

// --- Certificate Approvals ---
export async function getCertificateApprovalsByUser(userId: string): Promise<StoredCertificateApproval[]> {
  const res = await query(
    `SELECT * FROM certificate_approvals WHERE user_id = $1 AND status = 'approved' ORDER BY approved_at DESC`,
    [userId]
  );
  return res.rows.map(rowToCertificateApproval);
}

export async function getCertificateApprovals(): Promise<StoredCertificateApproval[]> {
  const res = await query('SELECT * FROM certificate_approvals ORDER BY approved_at DESC');
  return res.rows.map(rowToCertificateApproval);
}

export async function insertCertificateApproval(a: StoredCertificateApproval): Promise<StoredCertificateApproval> {
  const res = await query(
    `INSERT INTO certificate_approvals (id, template_id, user_id, event_id, status, note, approved_at, approved_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (template_id, user_id) DO UPDATE SET
       status = EXCLUDED.status, note = EXCLUDED.note, approved_at = EXCLUDED.approved_at, approved_by = EXCLUDED.approved_by
     RETURNING *`,
    [a.id, a.templateId, a.userId, a.eventId ?? null, a.status, a.note ?? null, a.approvedAt, a.approvedBy ?? null]
  );
  return rowToCertificateApproval(res.rows[0]);
}

export async function deleteCertificateApproval(id: string): Promise<boolean> {
  const res = await query('DELETE FROM certificate_approvals WHERE id = $1 RETURNING id', [id]);
  return (res.rowCount ?? 0) > 0;
}
