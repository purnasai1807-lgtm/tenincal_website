const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(__dirname, 'e2e.db');
let child;
let port;
let primaryEventId;

function startServer() {
  child = execFile(process.execPath, ['server.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '0',
      DB_PATH: dbPath,
      SESSION_SECRET: 'e2e-test-secret',
      TRUST_PROXY: '1',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'admin-password-123'
    }
  });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      const match = chunk.toString().match(/:(\d+)/);
      if (match) { port = Number(match[1]); resolve(); }
    });
    child.on('error', reject);
  });
}

function request(method, route, body, cookie, forwardedIp) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      method, port, path: route,
      headers: {
        Host: `127.0.0.1:${port}`,
        Origin: `http://127.0.0.1:${port}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(forwardedIp ? { 'X-Forwarded-For': forwardedIp } : {})
      }
    };
    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: data && res.headers['content-type']?.includes('json') ? JSON.parse(data) : data
      }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function cookieFrom(response) {
  return response.headers['set-cookie']?.[0]?.split(';')[0];
}

test.before(async () => {
  try { fs.unlinkSync(dbPath); } catch {}
  await startServer();
});

test.after(() => {
  child.kill();
  try { fs.unlinkSync(dbPath); } catch {}
});

test('completes student registration, ticket, admin attendance, and filtered CSV flow', async () => {
  const unauthorizedReport = await request('GET', '/api/admin/reports/registrations.csv');
  assert.equal(unauthorizedReport.status, 401);
  const adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@example.com', password: 'admin-password-123'
  });
  assert.equal(adminLogin.status, 200);
  const adminCookie = cookieFrom(adminLogin);

  const eventResponse = await request('POST', '/api/manage/events', {
    title: 'E2E Community Event',
    description: 'A complete event flow test event.',
    startsAt: '2026-10-15T10:00:00.000Z',
    location: 'Main Hall',
    registrationUrl: 'https://example.com/register'
  }, adminCookie);
  assert.equal(eventResponse.status, 201);
  const event = eventResponse.body.event;
  primaryEventId = event.id;
  const listed = await request('GET', '/api/events');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.events[0].id, event.id);

  const students = await Promise.all([1, 2, 3, 4].map(async (number) => {
    const signup = await request('POST', '/api/auth/register', {
      name: `Student ${number}`, email: `student${number}@example.com`, password: 'student-password-123'
    });
    assert.equal(signup.status, 201);
    return { cookie: cookieFrom(signup), user: signup.body.user };
  }));
  await request('POST', '/api/auth/logout', undefined, students[0].cookie);
  const relogin = await request('POST', '/api/auth/login', {
    email: 'student1@example.com', password: 'student-password-123'
  });
  assert.equal(relogin.status, 200);
  students[0].cookie = cookieFrom(relogin);
  const registrations = await Promise.all(students.map((student, index) => request(
    'POST', `/api/events/${event.id}/register`, { collegeYear: `${index + 1} Year` }, student.cookie
  )));
  assert.deepEqual(registrations.map((response) => response.status), [201, 201, 201, 201]);
  assert.equal(new Set(registrations.map((response) => response.body.registration.id)).size, 4);

  const duplicate = await request('POST', `/api/events/${event.id}/register`, { collegeYear: '1 Year' }, students[0].cookie);
  assert.equal(duplicate.status, 409);

  const ticket = await request('GET', `/api/registrations/${registrations[0].body.registration.id}/ticket`, undefined, students[0].cookie);
  assert.equal(ticket.status, 200);
  assert.equal(ticket.body.ticket.code, registrations[0].body.ticket.code);

  const checkIn = await request('POST', '/api/admin/attendance/scan', { ticketCode: ticket.body.ticket.code, action: 'check_in' }, adminCookie);
  assert.equal(checkIn.status, 200);
  const forbiddenScan = await request('POST', '/api/admin/attendance/scan', { ticketCode: ticket.body.ticket.code, action: 'check_out' }, students[1].cookie);
  assert.equal(forbiddenScan.status, 403);
  const checkOut = await request('POST', '/api/admin/attendance/scan', { ticketCode: ticket.body.ticket.code, action: 'check_out' }, adminCookie);
  assert.equal(checkOut.status, 200);

  const report = await request('GET', '/api/admin/reports/registrations.csv?eventDate=2026-10-15&attendance=attended&status=ACTIVE&collegeYear=1%20Year', undefined, adminCookie);
  assert.equal(report.status, 200);
  assert.match(report.headers['content-type'], /text\/csv/);
  assert.match(report.body, /E2E Community Event/);
  assert.match(report.body, /Student 1/);
  assert.doesNotMatch(report.body, /Student 2/);

  const limitedEventResponse = await request('POST', '/api/manage/events', {
    title: 'Capacity Controlled Event',
    description: 'An event used to verify atomic capacity enforcement.',
    startsAt: '2026-11-15T10:00:00.000Z',
    location: 'Overflow Hall',
    registrationUrl: 'https://example.com/register',
    capacity: 2
  }, adminCookie);
  assert.equal(limitedEventResponse.status, 201);
  assert.equal(limitedEventResponse.body.event.capacity, 2);
  const limitedAttempts = await Promise.all(students.map((student, index) => request(
    'POST', `/api/events/${limitedEventResponse.body.event.id}/register`, { collegeYear: `${index + 1} Year` }, student.cookie
  )));
  assert.equal(limitedAttempts.filter((response) => response.status === 201).length, 2);
  assert.equal(limitedAttempts.filter((response) => response.status === 409).length, 2);
});

test('keeps simultaneous duplicate registration attempts atomic', async () => {
  const signup = await request('POST', '/api/auth/register', {
    name: 'Concurrent Student', email: 'concurrent@example.com', password: 'concurrent-password-123'
  });
  assert.equal(signup.status, 201);
  const cookie = cookieFrom(signup);
  const attempts = await Promise.all(Array.from({ length: 10 }, (_, index) => request(
    'POST', `/api/events/${primaryEventId}/register`, { collegeYear: '2 Year' }, cookie, `10.0.0.${index + 1}`
  )));
  assert.equal(attempts.filter((response) => response.status === 201).length, 1);
  assert.equal(attempts.filter((response) => response.status === 409).length, 9);
  assert.equal(attempts.filter((response) => response.status === 429).length, 0);
});
