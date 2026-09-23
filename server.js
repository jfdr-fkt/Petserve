// PetServe prototype. Local Node.js server with JSON storage and no npm dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DEFAULT_DB = path.join(ROOT, 'data', 'db.json');
const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const SERVICES = [
  { id: 'grooming', name: 'Pet grooming', group: 'Grooming', resource: 'groomer', icon: '✂', description: 'Request a grooming visit for your pet.' },
  { id: 'vaccination', name: 'Vaccination', group: 'Pet wellness', resource: 'veterinarian', icon: '✚', description: 'Request a vaccination appointment; clinical decisions stay with the veterinarian.' },
  { id: 'deworming', name: 'Deworming', group: 'Pet wellness', resource: 'veterinarian', icon: '◈', description: 'Request a deworming visit; clinical decisions stay with the veterinarian.' }
];
const STATUSES = ['pending', 'confirmed', 'completed', 'rejected', 'cancelled'];
const PAYMENT_METHODS = ['Cash', 'E-wallet', 'Other'];
const PUBLIC_USER = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) return false;
  const [salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

async function seedDatabase(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const demoHash = await hashPassword('Petserve123!');
  const owner = newId();
  const initial = {
    version: 1,
    users: [
      { id: owner, name: 'Alex Rivera', email: 'alex@example.test', role: 'customer', passwordHash: demoHash },
      { id: newId(), name: 'Clinic Staff', email: 'staff@petserve.test', role: 'staff', passwordHash: demoHash }
    ],
    pets: [{ id: newId(), ownerId: owner, name: 'Milo', species: 'Dog', breed: 'Aspin', age: '2 years', notes: '', createdAt: now() }],
    appointments: [],
    payments: []
  };
  fs.writeFileSync(file, JSON.stringify(initial, null, 2) + '\n', { flag: 'wx' });
  return initial;
}

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
function clean(value, limit = 120) { return typeof value === 'string' ? value.trim().slice(0, limit) : ''; }
function manilaNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
function dateIsBookable(date, time) {
  if (!validDate(date) || !TIME_SLOTS.includes(time)) return false;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day !== 0 && day !== 6) return false;
  const present = manilaNow();
  const daysAhead = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${present.date}T00:00:00Z`)) / 86400000);
  return daysAhead >= 0 && daysAhead <= 90 && (daysAhead !== 0 || time > present.time);
}
function paymentView(db, appointment) {
  const p = db.payments.find(item => item.appointmentId === appointment.id);
  return p ? { id: p.id, amount: p.amount, method: p.method, reference: p.reference, recordedAt: p.recordedAt } : null;
}
function appointmentView(db, appointment) {
  const pet = db.pets.find(item => item.id === appointment.petId);
  const owner = db.users.find(item => item.id === appointment.customerId);
  const service = SERVICES.find(item => item.id === appointment.serviceId);
  return {
    id: appointment.id, date: appointment.date, time: appointment.time,
    serviceId: appointment.serviceId, serviceName: service?.name ?? 'Service',
    petName: pet?.name ?? 'Pet', customerName: owner?.name ?? 'Customer',
    status: appointment.status, note: appointment.note, staffNote: appointment.staffNote,
    createdAt: appointment.createdAt, payment: paymentView(db, appointment)
  };
}

async function createApp(options = {}) {
  const dbFile = options.dbFile || DEFAULT_DB;
  const db = await seedDatabase(dbFile);
  const sessions = new Map();
  const persist = () => {
    const temporary = `${dbFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(db, null, 2) + '\n');
    fs.renameSync(temporary, dbFile);
  };
  function send(res, status, value, extraHeaders = {}) {
    const body = JSON.stringify(value);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', ...extraHeaders });
    res.end(body);
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => {
        raw += chunk;
        if (raw.length > 16000) { reject(httpError(413, 'Request is too large.')); req.destroy(); }
      });
      req.on('end', () => {
        try { resolve(raw ? JSON.parse(raw) : {}); }
        catch { reject(httpError(400, 'Invalid JSON.')); }
      });
      req.on('error', reject);
    });
  }
  function currentUser(req) {
    const token = /(?:^|;\s*)petserve_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const id = token && sessions.get(token);
    return db.users.find(u => u.id === id) || null;
  }
  function requireUser(user, role) {
    if (!user) throw httpError(401, 'Please sign in first.');
    if (role && user.role !== role) throw httpError(403, 'You do not have access to this action.');
  }
  function requireJson(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw httpError(415, 'Send JSON data.');
    // Block cross-origin form/script requests to the local demo server.
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw httpError(403, 'Cross-origin request blocked.');
  }
  function serveStatic(res, pathname) {
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const allowed = { 'index.html': 'text/html', 'styles.css': 'text/css', 'app.js': 'text/javascript', 'favicon.svg': 'image/svg+xml' };
    if (!Object.hasOwn(allowed, relative)) throw httpError(404, 'Page not found.');
    const file = path.join(PUBLIC, relative);
    const bytes = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': `${allowed[relative]}; charset=utf-8`, 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
    res.end(bytes);
  }
  const handler = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'");
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (!pathname.startsWith('/api/')) {
        if (req.method !== 'GET') throw httpError(405, 'Method not allowed.');
        return serveStatic(res, pathname);
      }
      const user = currentUser(req);
      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        return send(res, 200, {
          user: user ? PUBLIC_USER(user) : null, services: SERVICES, timeSlots: TIME_SLOTS,
          pets: user?.role === 'customer' ? db.pets.filter(p => p.ownerId === user.id) : [],
          appointments: user ? db.appointments.filter(a => user.role === 'staff' || a.customerId === user.id).map(a => appointmentView(db, a)).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)) : [],
          demoSchedule: 'Sample booking slots, Saturday and Sunday only, Asia/Manila. Confirm staff availability with Petopia.'
        });
      }
      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        requireJson(req);
        const token = /(?:^|;\s*)petserve_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        if (token) sessions.delete(token);
        return send(res, 200, { ok: true }, { 'Set-Cookie': 'petserve_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
      }
      if (req.method === 'POST' && (pathname === '/api/auth/login' || pathname === '/api/auth/register')) {
        requireJson(req);
        const data = await readBody(req);
        const email = clean(data.email, 160).toLowerCase();
        const password = typeof data.password === 'string' ? data.password : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) throw httpError(400, 'Enter a valid email address.');
        let account;
        if (pathname.endsWith('register')) {
          const name = clean(data.name, 80);
          if (name.length < 2 || password.length < 8 || password.length > 128) throw httpError(400, 'Enter your name and a password of at least 8 characters.');
          if (db.users.some(u => u.email === email)) throw httpError(409, 'This email is already registered.');
          account = { id: newId(), name, email, role: 'customer', passwordHash: await hashPassword(password) };
          db.users.push(account); persist();
        } else {
          account = db.users.find(u => u.email === email);
          if (!account || !(await verifyPassword(password, account.passwordHash))) throw httpError(401, 'Email or password is incorrect.');
        }
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, account.id);
        return send(res, 200, { user: PUBLIC_USER(account) }, { 'Set-Cookie': `petserve_session=${token}; HttpOnly; SameSite=Lax; Path=/` });
      }
      if (req.method === 'POST' && pathname === '/api/pets') {
        requireUser(user, 'customer'); requireJson(req);
        const data = await readBody(req);
        const name = clean(data.name, 80), species = clean(data.species, 40);
        if (name.length < 1 || !['Dog', 'Cat', 'Other'].includes(species)) throw httpError(400, 'Enter your pet’s name and type.');
        if (db.pets.filter(p => p.ownerId === user.id).length >= 25) throw httpError(400, 'Pet profile limit reached.');
        const pet = { id: newId(), ownerId: user.id, name, species, breed: clean(data.breed, 80), age: clean(data.age, 40), notes: clean(data.notes, 300), createdAt: now() };
        db.pets.push(pet); persist();
        return send(res, 201, { pet });
      }
      if (req.method === 'POST' && pathname === '/api/appointments') {
        requireUser(user, 'customer'); requireJson(req);
        const data = await readBody(req);
        const pet = db.pets.find(p => p.id === data.petId && p.ownerId === user.id);
        const service = SERVICES.find(s => s.id === data.serviceId);
        if (!pet || !service) throw httpError(400, 'Choose your pet and a listed service.');
        if (!dateIsBookable(data.date, data.time)) throw httpError(400, 'Choose a future sample weekend slot within 90 days.');
        if (db.appointments.some(a => a.customerId === user.id && a.petId === pet.id && a.date === data.date && a.time === data.time && ['pending', 'confirmed'].includes(a.status))) throw httpError(409, 'This pet already has a request for that time.');
        if (db.appointments.some(a => a.date === data.date && a.time === data.time && a.status === 'confirmed' && SERVICES.find(s => s.id === a.serviceId)?.resource === service.resource)) throw httpError(409, 'That slot is already confirmed for this service team. Please choose another.');
        const item = { id: newId(), customerId: user.id, petId: pet.id, serviceId: service.id, date: data.date, time: data.time, status: 'pending', note: clean(data.note, 300), staffNote: '', createdAt: now() };
        db.appointments.push(item); persist();
        return send(res, 201, { appointment: appointmentView(db, item) });
      }
      const statusRoute = /^\/api\/appointments\/([a-f0-9-]+)\/status$/.exec(pathname);
      if (req.method === 'PATCH' && statusRoute) {
        requireUser(user); requireJson(req);
        const item = db.appointments.find(a => a.id === statusRoute[1]);
        if (!item) throw httpError(404, 'Appointment not found.');
        const data = await readBody(req);
        const next = clean(data.status, 20);
        if (!STATUSES.includes(next)) throw httpError(400, 'Invalid appointment status.');
        if (user.role === 'customer') {
          if (item.customerId !== user.id || item.status !== 'pending' || next !== 'cancelled') throw httpError(403, 'You can only cancel your own pending request.');
        } else if (user.role === 'staff') {
          const allowed = item.status === 'pending' ? ['confirmed', 'rejected'] : item.status === 'confirmed' ? ['completed', 'cancelled'] : [];
          if (!allowed.includes(next)) throw httpError(409, 'That status change is not available.');
          const service = SERVICES.find(s => s.id === item.serviceId);
          if (next === 'confirmed' && db.appointments.some(a => a.id !== item.id && a.status === 'confirmed' && a.date === item.date && a.time === item.time && SERVICES.find(s => s.id === a.serviceId)?.resource === service.resource)) throw httpError(409, 'Another booking already uses that service team and slot.');
          if (next === 'confirmed' && !dateIsBookable(item.date, item.time)) throw httpError(409, 'That slot is no longer available.');
          if (typeof data.staffNote === 'string') item.staffNote = clean(data.staffNote, 300);
        } else throw httpError(403, 'Role not supported.');
        item.status = next; persist();
        return send(res, 200, { appointment: appointmentView(db, item) });
      }
      const paymentRoute = /^\/api\/appointments\/([a-f0-9-]+)\/payment$/.exec(pathname);
      if (req.method === 'POST' && paymentRoute) {
        requireUser(user, 'staff'); requireJson(req);
        const item = db.appointments.find(a => a.id === paymentRoute[1]);
        if (!item) throw httpError(404, 'Appointment not found.');
        if (item.status !== 'completed') throw httpError(409, 'Mark the service completed before recording payment.');
        if (db.payments.some(p => p.appointmentId === item.id)) throw httpError(409, 'Payment has already been recorded.');
        const data = await readBody(req);
        const amount = Number(data.amount);
        const method = clean(data.method, 30);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000 || Math.round(amount * 100) / 100 !== amount || !PAYMENT_METHODS.includes(method)) throw httpError(400, 'Enter a positive amount (up to two decimals) and a payment method.');
        const payment = { id: newId(), appointmentId: item.id, amount: Math.round(amount * 100), method, reference: clean(data.reference, 60), recordedAt: now(), recordedBy: user.id };
        db.payments.push(payment); persist();
        return send(res, 201, { appointment: appointmentView(db, item) });
      }
      if (req.method === 'GET' && pathname === '/api/report') {
        requireUser(user, 'staff');
        const counts = Object.fromEntries(STATUSES.map(s => [s, db.appointments.filter(a => a.status === s).length]));
        return send(res, 200, { counts, amountCollected: db.payments.reduce((sum, p) => sum + p.amount, 0), paymentsRecorded: db.payments.length });
      }
      throw httpError(404, 'Page not found.');
    } catch (error) {
      if (!res.writableEnded && !res.destroyed) send(res, error.status || 500, { error: error.status ? error.message : 'Unexpected server error.' });
      if (!error.status) console.error(error);
    }
  };
  const server = http.createServer(handler);
  return { server, dbFile };
}

if (require.main === module) {
  createApp().then(({ server }) => {
    const port = Number(process.env.PORT) || 3000;
    server.listen(port, '127.0.0.1', () => console.log(`PetServe running at http://127.0.0.1:${port}`));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { createApp };
