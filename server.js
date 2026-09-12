const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');
const { z } = require('zod');

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'tensorhub.db');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TECHNICAL_TEAM_EMAIL = process.env.TECHNICAL_TEAM_EMAIL;
const TECHNICAL_TEAM_PASSWORD = process.env.TECHNICAL_TEAM_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const APP_ORIGIN = process.env.APP_ORIGIN;
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
async function main() {
const SQL = await initSqlJs({ locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file) });
const db = new SQL.Database(fs.existsSync(DB_PATH) ? new Uint8Array(fs.readFileSync(DB_PATH)) : undefined);
const sql = (statement) => {
  const prepared = db.prepare(statement.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, '$$$1'));
  const bindValues = (values) => { if (!values.length) return; const value = values.length === 1 && values[0] && typeof values[0] === 'object' && !Array.isArray(values[0]) ? Object.fromEntries(Object.entries(values[0]).map(([key, item]) => [`$${key}`, item])) : values; prepared.bind(value); };
  return {
    run: (...values) => { bindValues(values); while (prepared.step()) {} const changes = db.getRowsModified(); const lastInsertRowid = db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0]; prepared.free(); persist(); return { changes, lastInsertRowid }; },
    get: (...values) => { bindValues(values); const value = prepared.step() ? prepared.getAsObject() : undefined; prepared.free(); return value; },
    all: (...values) => { bindValues(values); const rows = []; while (prepared.step()) rows.push(prepared.getAsObject()); prepared.free(); return rows; }
  };
};
const persist = () => fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'MEMBER',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT,
    location TEXT NOT NULL, registration_url TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS events_listing_idx ON events(published, starts_at);
  CREATE TABLE IF NOT EXISTS event_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    college_year TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'WAITLISTED')),
    attended INTEGER NOT NULL DEFAULT 0 CHECK (attended IN (0, 1)),
    checked_in_at TEXT,
    checked_out_at TEXT,
    ticket_code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS event_registrations_event_idx ON event_registrations(event_id, status);
  CREATE INDEX IF NOT EXISTS event_registrations_reporting_idx ON event_registrations(college_year, status, attended, created_at);
  CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL,
    language TEXT NOT NULL, starter_code TEXT NOT NULL DEFAULT '', created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, challenge_id INTEGER NOT NULL REFERENCES challenges(id),
    user_id INTEGER NOT NULL REFERENCES users(id), source_code TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'QUEUED',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS submissions_user_idx ON submissions(user_id, created_at);
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, metadata TEXT NOT NULL DEFAULT '{}',
    ip TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at);
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN',
    resolution TEXT, resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT
  );
  CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at);
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read_at, created_at);
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
try { db.run('ALTER TABLE event_registrations ADD COLUMN ticket_code TEXT'); } catch {}
db.run('CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_ticket_idx ON event_registrations(ticket_code)');

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const emailSchema = z.string().trim().email().max(254).transform((v) => v.toLowerCase());
const passwordSchema = z.string().min(12).max(128);
const eventSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10000),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  location: z.string().trim().min(2).max(200),
  registrationUrl: z.string().url().refine((v) => ['http:', 'https:'].includes(new URL(v).protocol), 'HTTPS or HTTP URL required'),
  published: z.boolean().optional().default(true)
});
const slugify = (value) => `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
const hashToken = (token) => crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const issue = (res, status, message, details) => res.status(status).json({ error: message, ...(details ? { details } : {}) });
const audit = (req, action, entityType, entityId, metadata = {}) => sql(
  'INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,metadata,ip) VALUES (?,?,?,?,?,?)'
).run(req.user?.id || null, action, entityType, entityId == null ? null : String(entityId), JSON.stringify(metadata), req.ip || null);
const notify = (userId, type, title, message) => sql(
  'INSERT INTO notifications (user_id,type,title,message) VALUES (?,?,?,?)'
).run(userId, type, title, message);
if (TECHNICAL_TEAM_EMAIL && TECHNICAL_TEAM_PASSWORD) {
  const email = emailSchema.parse(TECHNICAL_TEAM_EMAIL);
  passwordSchema.parse(TECHNICAL_TEAM_PASSWORD);
  const existing = sql('SELECT id FROM users WHERE email=?').get(email);
  if (existing) sql('UPDATE users SET role=? WHERE id=?').run('TECHNICAL_TEAM', existing.id);
  else sql('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(
    'TensorHub Technical Team', email, bcrypt.hashSync(TECHNICAL_TEAM_PASSWORD, 12), 'TECHNICAL_TEAM'
  );
}
if (ADMIN_EMAIL && ADMIN_PASSWORD) {
  const email = emailSchema.parse(ADMIN_EMAIL);
  passwordSchema.parse(ADMIN_PASSWORD);
  const existing = sql('SELECT id FROM users WHERE email=?').get(email);
  if (existing) sql('UPDATE users SET role=? WHERE id=?').run('ADMIN', existing.id);
  else sql('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(
    'TensorHub Administrator', email, bcrypt.hashSync(ADMIN_PASSWORD, 12), 'ADMIN'
  );
}

function setSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  sql('INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, datetime("now", "+7 days"))').run(hashToken(token), userId);
  res.cookie('tensorhub_session', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 86400000, path: '/'
  });
}
function clearSession(req, res) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)tensorhub_session=([^;]+)/)?.[1];
  if (token) sql('DELETE FROM sessions WHERE id_hash = ?').run(hashToken(token));
  res.clearCookie('tensorhub_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
}
function loadUser(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)tensorhub_session=([^;]+)/)?.[1];
  if (!token) return null;
  return sql(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id_hash=? AND s.expires_at > datetime('now')`).get(hashToken(token)) || null;
}
function requireAuth(req, res, next) {
  req.user = loadUser(req);
  if (!req.user) return issue(res, 401, 'Authentication required');
  next();
}
function requireTechnicalTeam(req, res, next) {
  if (!['TECHNICAL_TEAM', 'ADMIN'].includes(req.user.role)) return issue(res, 403, 'Technical Team role required');
  next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return issue(res, 403, 'Administrator role required');
  next();
}
function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { issue(res, 400, 'Invalid request', parsed.error.flatten().fieldErrors); return null; }
  return parsed.data;
}
function requireSameOrigin(req, res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  const source = req.get('origin') || req.get('referer');
  if (!source) return issue(res, 403, 'Origin header required');
  try {
    const expected = APP_ORIGIN ? new URL(APP_ORIGIN).origin : `${req.protocol}://${req.get('host')}`;
    if (new URL(source).origin !== expected) return issue(res, 403, 'Cross-origin request blocked');
  } catch { return issue(res, 403, 'Invalid request origin'); }
  next();
}
app.use('/api', requireSameOrigin);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'tensorhub' }));
app.post('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(100), email: emailSchema, password: passwordSchema }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Name, valid email, and password of at least 12 characters are required');
  const { name, email, password } = parsed.data;
  try {
    const result = sql('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)').run(name, email, bcrypt.hashSync(password, 12));
    const user = sql('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);
    audit(req, 'REGISTER', 'USER', user.id);
    setSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return issue(res, 409, 'An account with that email already exists');
    throw error;
  }
});
app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), (req, res) => {
  const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Email and password are required');
  const user = sql('SELECT * FROM users WHERE email=?').get(parsed.data.email);
  if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) return issue(res, 401, 'Invalid email or password');
  setSession(res, user.id);
  audit(req, 'LOGIN', 'USER', user.id);
  res.json({ user: publicUser(user) });
});
app.post('/api/auth/logout', (req, res) => { clearSession(req, res); res.status(204).end(); });
app.get('/api/auth/me', (req, res) => { const user = loadUser(req); res.json({ user: user ? publicUser(user) : null }); });
app.post('/api/auth/password-reset/request', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 }), (req, res) => {
  const parsed = z.object({ email: emailSchema }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Valid email is required');
  const user = sql('SELECT id FROM users WHERE email=?').get(parsed.data.email);
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    sql("DELETE FROM password_reset_tokens WHERE user_id=?").run(user.id);
    sql("INSERT INTO password_reset_tokens (token_hash,user_id,expires_at) VALUES (?,?,datetime('now','+30 minutes'))").run(hashToken(token), user.id);
    audit(req, 'PASSWORD_RESET_REQUESTED', 'USER', user.id);
    if (process.env.NODE_ENV !== 'production') return res.json({ ok: true, developmentToken: token });
  }
  res.json({ ok: true, message: 'If that account exists, reset instructions will be sent.' });
});
app.post('/api/auth/password-reset/complete', (req, res) => {
  const parsed = z.object({ token: z.string().min(20).max(200), password: passwordSchema }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Valid reset token and password of at least 12 characters are required');
  const token = sql("SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now')").get(hashToken(parsed.data.token));
  if (!token) return issue(res, 400, 'Reset token is invalid or expired');
  sql('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(parsed.data.password, 12), token.user_id);
  sql("UPDATE password_reset_tokens SET used_at=datetime('now') WHERE token_hash=?").run(hashToken(parsed.data.token));
  sql('DELETE FROM sessions WHERE user_id=?').run(token.user_id);
  audit(req, 'PASSWORD_RESET_COMPLETED', 'USER', token.user_id);
  res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 12));
  const search = String(req.query.search || '').trim().slice(0, 100);
  const where = search ? 'WHERE published=1 AND (title LIKE @search OR description LIKE @search OR location LIKE @search)' : 'WHERE published=1';
  const params = search ? { search: `%${search}%` } : {};
  const total = sql(`SELECT COUNT(*) count FROM events ${where}`).get(params).count;
  const events = sql(`SELECT id,title,slug,description,starts_at startsAt,ends_at endsAt,location,registration_url registrationUrl
    FROM events ${where} ORDER BY starts_at ASC LIMIT @limit OFFSET @offset`).all({ ...params, limit, offset: (page - 1) * limit });
  res.json({ events, page, limit, total, pages: Math.ceil(total / limit) });
});
app.get('/api/events/:slug', (req, res) => {
  const event = sql(`SELECT id,title,slug,description,starts_at startsAt,ends_at endsAt,location,registration_url registrationUrl
    FROM events WHERE slug=? AND published=1`).get(req.params.slug);
  if (!event) return issue(res, 404, 'Event not found');
  res.json({ event });
});
app.post('/api/events/:id/register', requireAuth, rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), (req, res) => {
  const parsed = z.object({ collegeYear: z.string().trim().min(1).max(30) }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'College year is required');
  const event = sql('SELECT id FROM events WHERE id=? AND published=1').get(req.params.id);
  if (!event) return issue(res, 404, 'Event not found');
  try {
    const ticketCode = `TH-${crypto.randomBytes(12).toString('base64url')}`;
    const result = sql('INSERT INTO event_registrations (event_id,user_id,college_year,ticket_code) VALUES (?,?,?,?)').run(event.id, req.user.id, parsed.data.collegeYear, ticketCode);
    audit(req, 'REGISTER', 'EVENT', event.id, { registrationId: result.lastInsertRowid, collegeYear: parsed.data.collegeYear });
    res.status(201).json({ registration: sql('SELECT * FROM event_registrations WHERE id=?').get(result.lastInsertRowid), ticket: { code: ticketCode, registrationId: result.lastInsertRowid } });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed/i.test(error.message || '')) {
      return issue(res, 409, 'You are already registered for this event');
    }
    throw error;
  }
});
app.get('/api/registrations/:id/ticket', requireAuth, (req, res) => {
  const registration = sql(`SELECT r.*, e.title event_title, e.starts_at event_date
    FROM event_registrations r JOIN events e ON e.id=r.event_id
    WHERE r.id=?`).get(req.params.id);
  if (!registration) return issue(res, 404, 'Registration not found');
  if (registration.user_id !== req.user.id && req.user.role !== 'ADMIN') return issue(res, 403, 'You cannot access this ticket');
  res.json({ ticket: { code: registration.ticket_code, registrationId: registration.id, event: registration.event_title, eventDate: registration.event_date, status: registration.status } });
});
app.use('/api/manage', requireAuth, requireTechnicalTeam);
app.post('/api/manage/events', (req, res) => {
  const data = parseBody(eventSchema, req, res); if (!data) return;
  if (data.endsAt && new Date(data.endsAt) <= new Date(data.startsAt)) return issue(res, 400, 'End time must be after start time');
  const result = sql(`INSERT INTO events (title,slug,description,starts_at,ends_at,location,registration_url,published,created_by)
    VALUES (@title,@slug,@description,@startsAt,@endsAt,@location,@registrationUrl,@published,@createdBy)`).run({ ...data, slug: slugify(data.title), createdBy: req.user.id });
  res.status(201).json({ event: sql('SELECT * FROM events WHERE id=?').get(result.lastInsertRowid) });
  audit(req, 'CREATE', 'EVENT', result.lastInsertRowid, { title: data.title });
});
app.patch('/api/manage/events/:id', (req, res) => {
  const data = parseBody(eventSchema.partial(), req, res); if (!data) return;
  const current = sql('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!current) return issue(res, 404, 'Event not found');
  const next = { ...current, ...data };
  if (next.endsAt && new Date(next.endsAt) <= new Date(next.startsAt)) return issue(res, 400, 'End time must be after start time');
  sql(`UPDATE events SET title=@title,description=@description,starts_at=@startsAt,ends_at=@endsAt,location=@location,
    registration_url=@registrationUrl,published=@published,updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({
    ...next, id: current.id, startsAt: next.startsAt, endsAt: next.endsAt, registrationUrl: next.registrationUrl, published: next.published ? 1 : 0
  });
  res.json({ event: sql('SELECT * FROM events WHERE id=?').get(current.id) });
});
app.delete('/api/manage/events/:id', (req, res) => {
  const result = sql('DELETE FROM events WHERE id=?').run(req.params.id);
  if (!result.changes) return issue(res, 404, 'Event not found');
  audit(req, 'DELETE', 'EVENT', req.params.id);
  res.status(204).end();
});
app.get('/api/challenges', (_req, res) => res.json({ challenges: sql('SELECT id,title,description,language,starter_code starterCode FROM challenges ORDER BY created_at DESC LIMIT 100').all() }));
app.get('/api/challenges/:id', (req, res) => {
  const challenge = sql('SELECT id,title,description,language,starter_code starterCode FROM challenges WHERE id=?').get(req.params.id);
  if (!challenge) return issue(res, 404, 'Challenge not found');
  res.json({ challenge });
});
app.post('/api/challenges/:id/submissions', requireAuth, rateLimit({ windowMs: 60 * 1000, limit: 10 }), (req, res) => {
  const challenge = sql('SELECT id FROM challenges WHERE id=?').get(req.params.id);
  if (!challenge) return issue(res, 404, 'Challenge not found');
  const parsed = z.object({ sourceCode: z.string().min(1).max(50000) }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Source code is required and must be at most 50,000 characters');
  const result = sql('INSERT INTO submissions (challenge_id,user_id,source_code,status) VALUES (?,?,?,?)').run(challenge.id, req.user.id, parsed.data.sourceCode, 'QUEUED');
  res.status(202).json({ submission: { id: result.lastInsertRowid, status: 'QUEUED', message: 'Submission queued for isolated worker processing.' } });
});
app.post('/api/manage/challenges', (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(3).max(160), description: z.string().trim().min(10).max(10000), language: z.string().trim().min(1).max(40), starterCode: z.string().max(50000).default('') }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Invalid challenge');
  const result = sql('INSERT INTO challenges (title,description,language,starter_code,created_by) VALUES (?,?,?,?,?)').run(parsed.data.title, parsed.data.description, parsed.data.language, parsed.data.starterCode, req.user.id);
  audit(req, 'CREATE', 'CHALLENGE', result.lastInsertRowid, { title: parsed.data.title });
  res.status(201).json({ id: result.lastInsertRowid });
});
app.post('/api/reports', requireAuth, (req, res) => {
  const parsed = z.object({ entityType: z.enum(['EVENT', 'CHALLENGE']), entityId: z.string().max(50), reason: z.string().trim().min(10).max(1000) }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'A valid content type, id, and reason are required');
  const result = sql('INSERT INTO reports (reporter_id,entity_type,entity_id,reason) VALUES (?,?,?,?)').run(req.user.id, parsed.data.entityType, parsed.data.entityId, parsed.data.reason);
  audit(req, 'REPORT', parsed.data.entityType, parsed.data.entityId);
  res.status(201).json({ reportId: result.lastInsertRowid, status: 'OPEN' });
});
app.get('/api/notifications', requireAuth, (req, res) => res.json({ notifications: sql('SELECT id,type,title,message,read_at readAt,created_at createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id) }));
app.post('/api/notifications/:id/read', requireAuth, (req, res) => { const result = sql("UPDATE notifications SET read_at=datetime('now') WHERE id=? AND user_id=?").run(req.params.id, req.user.id); if (!result.changes) return issue(res, 404, 'Notification not found'); res.status(204).end(); });
app.use('/api/admin', requireAuth, requireAdmin);
app.post('/api/admin/attendance/scan', rateLimit({ windowMs: 60 * 1000, limit: 60 }), (req, res) => {
  const parsed = z.object({ ticketCode: z.string().trim().min(3).max(100), action: z.enum(['check_in', 'check_out']) }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Ticket code and scan action are required');
  const registration = sql(`SELECT r.*, e.title event_title
    FROM event_registrations r JOIN events e ON e.id=r.event_id
    WHERE r.ticket_code=?`).get(parsed.data.ticketCode);
  if (!registration) return issue(res, 404, 'Ticket not found');
  if (registration.status !== 'ACTIVE') return issue(res, 409, 'Registration is not active');
  const column = parsed.data.action === 'check_in' ? 'checked_in_at' : 'checked_out_at';
  const timestamp = new Date().toISOString();
  sql(`UPDATE event_registrations SET ${column}=?, attended=? WHERE id=?`).run(timestamp, parsed.data.action === 'check_in' ? 1 : registration.attended, registration.id);
  audit(req, parsed.data.action.toUpperCase(), 'REGISTRATION', registration.id, { eventId: registration.event_id, ticketCode: parsed.data.ticketCode });
  res.json({ attendance: { registrationId: registration.id, action: parsed.data.action, timestamp } });
});
app.get('/api/admin/users', (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const users = sql('SELECT id,name,email,role,created_at createdAt FROM users ORDER BY created_at DESC LIMIT @limit OFFSET @offset').all({ limit, offset: (page - 1) * limit });
  res.json({ users, page, limit });
});
app.patch('/api/admin/users/:id/role', (req, res) => {
  const parsed = z.object({ role: z.enum(['MEMBER', 'TECHNICAL_TEAM', 'ADMIN']) }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Invalid role');
  if (Number(req.params.id) === req.user.id && parsed.data.role !== 'ADMIN') return issue(res, 400, 'You cannot remove your own administrator role');
  const result = sql('UPDATE users SET role=? WHERE id=?').run(parsed.data.role, req.params.id);
  if (!result.changes) return issue(res, 404, 'User not found');
  audit(req, 'ROLE_CHANGED', 'USER', req.params.id, { role: parsed.data.role });
  notify(Number(req.params.id), 'ROLE_CHANGED', 'Role updated', `Your TensorHub role is now ${parsed.data.role}.`);
  res.json({ ok: true });
});
app.get('/api/admin/reports', (req, res) => res.json({ reports: sql('SELECT id,reporter_id reporterId,entity_type entityType,entity_id entityId,reason,status,resolution,created_at createdAt FROM reports ORDER BY created_at DESC LIMIT 100').all() }));
app.patch('/api/admin/reports/:id', (req, res) => {
  const parsed = z.object({ status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']), resolution: z.string().trim().max(1000).optional().default('') }).safeParse(req.body);
  if (!parsed.success) return issue(res, 400, 'Invalid moderation update');
  const result = sql("UPDATE reports SET status=?,resolution=?,resolved_by=?,resolved_at=datetime('now') WHERE id=?").run(parsed.data.status, parsed.data.resolution, req.user.id, req.params.id);
  if (!result.changes) return issue(res, 404, 'Report not found');
  audit(req, 'MODERATION_UPDATE', 'REPORT', req.params.id, parsed.data);
  res.json({ ok: true });
});
app.get('/api/admin/audit-logs', (req, res) => res.json({ logs: sql('SELECT id,actor_id actorId,action,entity_type entityType,entity_id entityId,metadata,ip,created_at createdAt FROM audit_logs ORDER BY created_at DESC LIMIT 200').all() }));
app.get('/api/admin/reports/registrations.csv', (req, res) => {
  const filterSchema = z.object({
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    attendance: z.enum(['all', 'attended', 'not_attended']).default('all'),
    status: z.enum(['all', 'ACTIVE', 'CANCELLED', 'WAITLISTED']).default('all'),
    collegeYear: z.string().trim().max(30).optional()
  });
  const parsed = filterSchema.safeParse({
    eventDate: req.query.eventDate || undefined,
    attendance: req.query.attendance || 'all',
    status: req.query.status || 'all',
    collegeYear: req.query.collegeYear || undefined
  });
  if (!parsed.success) return issue(res, 400, 'Invalid report filters');
  const filters = parsed.data;
  const conditions = [];
  const params = {};
  if (filters.eventDate) { conditions.push("date(e.starts_at) = @eventDate"); params.eventDate = filters.eventDate; }
  if (filters.attendance === 'attended') conditions.push('r.attended = 1');
  if (filters.attendance === 'not_attended') conditions.push('r.attended = 0');
  if (filters.status !== 'all') { conditions.push('r.status = @status'); params.status = filters.status; }
  if (filters.collegeYear) { conditions.push('r.college_year = @collegeYear'); params.collegeYear = filters.collegeYear; }
  const rows = sql(`SELECT r.id, e.title event_title, e.starts_at event_date, u.name participant_name, u.email,
      r.college_year, r.status, r.attended, r.checked_in_at, r.checked_out_at, r.created_at registered_at
    FROM event_registrations r
    JOIN events e ON e.id = r.event_id
    JOIN users u ON u.id = r.user_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY e.starts_at DESC, r.created_at DESC`).all(params);
  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = ['Registration ID', 'Event', 'Event Date', 'Participant', 'Email', 'College Year', 'Registration Status', 'Attendance', 'Checked In At', 'Checked Out At', 'Registered At'];
  const lines = [header.map(csvCell).join(',')];
  rows.forEach((row) => lines.push([
    row.id, row.event_title, row.event_date, row.participant_name, row.email, row.college_year,
    row.status, row.attended ? 'ATTENDED' : 'NOT_ATTENDED', row.checked_in_at, row.checked_out_at, row.registered_at
  ].map(csvCell).join(',')));
  audit(req, 'EXPORT', 'REGISTRATIONS', null, { filters, count: rows.length });
  res.type('text/csv').attachment(`registrations-${new Date().toISOString().slice(0, 10)}.csv`).send(`\uFEFF${lines.join('\r\n')}\r\n`);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});
app.get('*', (req, res, next) => req.path.startsWith('/api/') ? issue(res, 404, 'Not found') : res.sendFile(path.join(__dirname, 'public', 'index.html'), (error) => error ? next(error) : undefined));
sql("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
const server = app.listen(PORT, '0.0.0.0', () => console.log(`TensorHub listening on 0.0.0.0:${server.address().port}`));
const shutdown = () => { server.close(() => { persist(); db.close(); process.exit(0); }); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
main().catch((error) => { console.error(error); process.exit(1); });
