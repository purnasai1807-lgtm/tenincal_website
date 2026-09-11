// db.ts — Postgres-backed persistence layer.
//
// Replaces the previous in-memory arrays (users/events/registrations) so data
// survives restarts, redeploys, and (if ever moved back to a stateless
// platform like Vercel Functions) cold starts.
//
// Connection string comes from the POSTGRES_URL environment variable — never
// hardcode credentials here. Any standard Postgres provider works (Neon,
// Supabase, Render Postgres, RDS, etc.).
//
// Pool sizing: this app currently runs as a long-lived Node process (Render
// web service), so a small connection pool is safe. If this is ever deployed
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT
    );
  `);

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

  await query(`CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);`);
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
       is_flagship, created_at, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
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
       capacity = $12, topics = $13, schedule = $14, speakers = $15, is_flagship = $16
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
       registered_at, attended, check_in_time, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
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
