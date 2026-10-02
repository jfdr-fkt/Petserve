// src/routes.js — All HTTP API route handlers, organized by domain.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { TIME_SLOTS, SERVICES, STATUSES, PAYMENT_METHODS, DEMO_SCHEDULE_NOTE } = require('./config');
const {
  hashPassword, verifyPassword,
  appointmentView, PUBLIC_USER,
  newId, now
} = require('./db');
const { httpError, clean, manilaNow, dateIsBookable } = require('./helpers');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const STATIC_FILES = {
  'index.html': 'text/html',
  'styles.css': 'text/css',
  'favicon.svg': 'image/svg+xml',
  // Serve every file under public/js/ dynamically (see serveStatic)
};

// ─── Core Middleware Helpers ──────────────────────────────────────────────────

function send(res, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 5000000) { reject(httpError(413, 'Request is too large.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(httpError(400, 'Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

function requireUser(user, role) {
  if (!user) throw httpError(401, 'Please sign in first.');
  if (role && user.role !== role) throw httpError(403, 'You do not have access to this action.');
}

function requireJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''))
    throw httpError(415, 'Send JSON data.');
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
    throw httpError(403, 'Cross-origin request blocked.');
}

function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);

  // Allow index.html, styles.css, favicon.svg, and anything under js/
  const mimeMap = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml'
  };
  const ext = path.extname(relative);
  const mime = mimeMap[ext];
  const file = path.join(PUBLIC_DIR, relative);

  // Security: must stay inside public directory
  if (!mime || !file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR) {
    throw httpError(404, 'Page not found.');
  }
  if (!fs.existsSync(file)) throw httpError(404, 'Page not found.');

  const bytes = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': `${mime}; charset=utf-8`,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store'
  });
  res.end(bytes);
}

// ─── Route Builder ────────────────────────────────────────────────────────────

/**
 * Creates the main request handler with access to db, sessions, and persist.
 * Called once during app creation.
 */
function createHandler(db, sessions, persist) {
  function currentUser(req) {
    const token = /(?:^|;\s*)petserve_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const id = token && sessions.get(token);
    return db.users.find(u => u.id === id) || null;
  }

  return async function handler(req, res) {
    // ── Security headers ─────────────────────────────────────────────────────
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; " +
      "img-src 'self' data: https: http:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
    );

    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;

      // ── Static file serving ──────────────────────────────────────────────
      if (!pathname.startsWith('/api/')) {
        if (req.method !== 'GET') throw httpError(405, 'Method not allowed.');
        return serveStatic(res, pathname);
      }

      const user = currentUser(req);

      // ── GET /api/bootstrap ───────────────────────────────────────────────
      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        const userPets =
          user?.role === 'customer' ? db.pets.filter(p => p.ownerId === user.id && !p.deletedAt) :
          user?.role === 'staff'    ? db.pets.filter(p => !p.deletedAt) : [];
        const petIds = new Set(userPets.map(p => p.id));
        return send(res, 200, {
          user: user ? PUBLIC_USER(user) : null,
          services: SERVICES,
          timeSlots: TIME_SLOTS,
          pets: userPets,
          healthLogs: db.healthLogs.filter(h => petIds.has(h.petId)),
          appointments: user
            ? db.appointments
                .filter(a => user.role === 'staff' || a.customerId === user.id)
                .map(a => appointmentView(db, a))
                .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
            : [],
          demoSchedule: DEMO_SCHEDULE_NOTE
        });
      }

      // ── POST /api/auth/logout ─────────────────────────────────────────────
      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        requireJson(req);
        const token = /(?:^|;\s*)petserve_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        if (token) sessions.delete(token);
        return send(res, 200, { ok: true }, {
          'Set-Cookie': 'petserve_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
        });
      }

      // ── POST /api/auth/login  &  POST /api/auth/register ─────────────────
      if (req.method === 'POST' && (pathname === '/api/auth/login' || pathname === '/api/auth/register')) {
        requireJson(req);
        const data = await readBody(req);
        const email = clean(data.email, 160).toLowerCase();
        const password = typeof data.password === 'string' ? data.password : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160)
          throw httpError(400, 'Enter a valid email address.');

        let account;
        if (pathname.endsWith('register')) {
          const name = clean(data.name, 80);
          if (name.length < 2 || password.length < 8 || password.length > 128)
            throw httpError(400, 'Enter your name and a password of at least 8 characters.');
          if (db.users.some(u => u.email === email))
            throw httpError(409, 'This email is already registered.');
          account = { id: newId(), name, email, role: 'customer', passwordHash: await hashPassword(password) };
          db.users.push(account);
          persist();
        } else {
          account = db.users.find(u => u.email === email);
          if (!account || !(await verifyPassword(password, account.passwordHash)))
            throw httpError(401, 'Email or password is incorrect.');
        }

        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, account.id);
        return send(res, 200, { user: PUBLIC_USER(account) }, {
          'Set-Cookie': `petserve_session=${token}; HttpOnly; SameSite=Lax; Path=/`
        });
      }

      // ── POST /api/pets ────────────────────────────────────────────────────
      if (req.method === 'POST' && pathname === '/api/pets') {
        requireUser(user, 'customer'); requireJson(req);
        const data = await readBody(req);
        const name = clean(data.name, 80);
        const species = clean(data.species, 40);
        if (name.length < 1 || !['Dog', 'Cat', 'Other'].includes(species))
          throw httpError(400, 'Enter your pet\'s name and type.');
        if (db.pets.filter(p => p.ownerId === user.id && !p.deletedAt).length >= 25)
          throw httpError(400, 'Pet profile limit reached.');
        const photoUrl = typeof data.photoUrl === 'string' ? data.photoUrl.slice(0, 2000000) : '';
        const pet = {
          id: newId(), ownerId: user.id, name, species,
          breed: clean(data.breed, 80), age: clean(data.age, 40),
          notes: clean(data.notes, 300), photoUrl, createdAt: now()
        };
        db.pets.push(pet);
        persist();
        return send(res, 201, { pet });
      }

      // ── PATCH /api/pets/:id ───────────────────────────────────────────────
      const petUpdateRoute = /^\/api\/pets\/([a-f0-9-]+)$/.exec(pathname);
      if (req.method === 'PATCH' && petUpdateRoute) {
        requireUser(user); requireJson(req);
        const pet = db.pets.find(p => p.id === petUpdateRoute[1]);
        if (!pet || pet.deletedAt) throw httpError(404, 'Pet profile not found.');
        if (user.role === 'customer' && pet.ownerId !== user.id) throw httpError(403, 'Access denied.');
        const data = await readBody(req);
        if (typeof data.name    === 'string' && data.name.trim()) pet.name  = clean(data.name, 80);
        if (typeof data.species === 'string' && ['Dog', 'Cat', 'Other'].includes(data.species)) pet.species = data.species;
        if (typeof data.breed   === 'string') pet.breed   = clean(data.breed, 80);
        if (typeof data.age     === 'string') pet.age     = clean(data.age, 40);
        if (typeof data.notes   === 'string') pet.notes   = clean(data.notes, 300);
        if (typeof data.photoUrl === 'string') pet.photoUrl = data.photoUrl.slice(0, 2000000);
        persist();
        return send(res, 200, { pet });
      }

      // ── DELETE /api/pets/:id ──────────────────────────────────────────────
      if (req.method === 'DELETE' && petUpdateRoute) {
        requireUser(user, 'customer');
        const pet = db.pets.find(p => p.id === petUpdateRoute[1]);
        if (!pet || pet.deletedAt) throw httpError(404, 'Pet profile not found.');
        if (pet.ownerId !== user.id) throw httpError(403, 'Access denied.');
        pet.deletedAt = now();
        persist();
        return send(res, 200, { ok: true });
      }

      // ── POST /api/pets/:id/health-logs ────────────────────────────────────
      const petHealthRoute = /^\/api\/pets\/([a-f0-9-]+)\/health-logs$/.exec(pathname);
      if (req.method === 'POST' && petHealthRoute) {
        requireUser(user); requireJson(req);
        const pet = db.pets.find(p => p.id === petHealthRoute[1]);
        if (!pet || pet.deletedAt) throw httpError(404, 'Pet not found.');
        if (user.role === 'customer' && pet.ownerId !== user.id) throw httpError(403, 'Access denied.');
        const data = await readBody(req);
        const title = clean(data.title, 100);
        if (!title) throw httpError(400, 'Health log title is required.');
        const type = ['vaccine', 'medical', 'deworming'].includes(data.type) ? data.type : 'medical';
        const log = {
          id: newId(), petId: pet.id, type, title,
          date: clean(data.date, 10) || manilaNow().date,
          notes: clean(data.notes, 300), createdAt: now()
        };
        db.healthLogs.push(log);
        persist();
        return send(res, 201, { healthLog: log });
      }

      // ── POST /api/appointments ────────────────────────────────────────────
      if (req.method === 'POST' && pathname === '/api/appointments') {
        requireUser(user, 'customer'); requireJson(req);
        const data = await readBody(req);
        const pet     = db.pets.find(p => p.id === data.petId && p.ownerId === user.id && !p.deletedAt);
        const service = SERVICES.find(s => s.id === data.serviceId);
        if (!pet || !service) throw httpError(400, 'Choose your pet and a listed service.');
        if (!dateIsBookable(data.date, data.time))
          throw httpError(400, 'Choose a future sample weekend slot within 90 days.');
        if (db.appointments.some(a =>
          a.customerId === user.id && a.petId === pet.id &&
          a.date === data.date && a.time === data.time &&
          ['pending', 'confirmed'].includes(a.status)
        )) throw httpError(409, 'This pet already has a request for that time.');
        if (db.appointments.some(a =>
          a.date === data.date && a.time === data.time && a.status === 'confirmed' &&
          SERVICES.find(s => s.id === a.serviceId)?.resource === service.resource
        )) throw httpError(409, 'That slot is already confirmed for this service team. Please choose another.');

        const item = {
          id: newId(), customerId: user.id, petId: pet.id, serviceId: service.id,
          date: data.date, time: data.time, status: 'pending',
          note: clean(data.note, 300), staffNote: '', createdAt: now()
        };
        db.appointments.push(item);
        persist();
        return send(res, 201, { appointment: appointmentView(db, item) });
      }

      // ── PATCH /api/appointments/:id/status ───────────────────────────────
      const statusRoute = /^\/api\/appointments\/([a-f0-9-]+)\/status$/.exec(pathname);
      if (req.method === 'PATCH' && statusRoute) {
        requireUser(user); requireJson(req);
        const item = db.appointments.find(a => a.id === statusRoute[1]);
        if (!item) throw httpError(404, 'Appointment not found.');
        const data = await readBody(req);
        const next = clean(data.status, 20);
        if (!STATUSES.includes(next)) throw httpError(400, 'Invalid appointment status.');

        if (user.role === 'customer') {
          if (item.customerId !== user.id || !['pending', 'confirmed'].includes(item.status) || item.payment || next !== 'cancelled')
            throw httpError(403, 'You can only cancel your own unpaid pending or confirmed appointment.');
        } else if (user.role === 'staff') {
          const allowed =
            item.status === 'pending'   ? ['confirmed', 'rejected'] :
            item.status === 'confirmed' ? ['completed', 'cancelled'] : [];
          if (!allowed.includes(next)) throw httpError(409, 'That status change is not available.');
          const service = SERVICES.find(s => s.id === item.serviceId);
          if (next === 'confirmed' && db.appointments.some(a =>
            a.id !== item.id && a.status === 'confirmed' &&
            a.date === item.date && a.time === item.time &&
            SERVICES.find(s => s.id === a.serviceId)?.resource === service.resource
          )) throw httpError(409, 'Another booking already uses that service team and slot.');
          if (next === 'confirmed' && !dateIsBookable(item.date, item.time))
            throw httpError(409, 'That slot is no longer available.');
          if (typeof data.staffNote === 'string') item.staffNote = clean(data.staffNote, 300);
        } else {
          throw httpError(403, 'Role not supported.');
        }

        item.status = next;
        persist();
        return send(res, 200, { appointment: appointmentView(db, item) });
      }

      // ── POST /api/appointments/:id/online-payment ─────────────────────────
      const onlinePayRoute = /^\/api\/appointments\/([a-f0-9-]+)\/online-payment$/.exec(pathname);
      if (req.method === 'POST' && onlinePayRoute) {
        requireUser(user, 'customer'); requireJson(req);
        const item = db.appointments.find(a => a.id === onlinePayRoute[1]);
        if (!item) throw httpError(404, 'Appointment not found.');
        if (item.customerId !== user.id) throw httpError(403, 'You can only pay for your own appointments.');
        if (db.payments.some(p => p.appointmentId === item.id))
          throw httpError(409, 'Payment has already been made for this visit.');
        const data = await readBody(req);
        const amount = Number(data.amount);
        const method = clean(data.method, 30) || 'GCash';
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000 ||
            Math.round(amount * 100) / 100 !== amount)
          throw httpError(400, 'Invalid payment amount.');
        const payment = {
          id: newId(), appointmentId: item.id, amount: Math.round(amount * 100), method,
          reference: clean(data.reference, 60) || `ONLINE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          recordedAt: now(), recordedBy: user.id
        };
        db.payments.push(payment);
        if (item.status === 'pending') item.status = 'confirmed';
        persist();
        return send(res, 201, { appointment: appointmentView(db, item) });
      }

      // ── POST /api/appointments/:id/payment  (staff manual) ───────────────
      const paymentRoute = /^\/api\/appointments\/([a-f0-9-]+)\/payment$/.exec(pathname);
      if (req.method === 'POST' && paymentRoute) {
        requireUser(user, 'staff'); requireJson(req);
        const item = db.appointments.find(a => a.id === paymentRoute[1]);
        if (!item) throw httpError(404, 'Appointment not found.');
        if (item.status !== 'completed')
          throw httpError(409, 'Mark the service completed before recording payment.');
        if (db.payments.some(p => p.appointmentId === item.id))
          throw httpError(409, 'Payment has already been recorded.');
        const data = await readBody(req);
        const amount = Number(data.amount);
        const method = clean(data.method, 30);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000 ||
            Math.round(amount * 100) / 100 !== amount || !PAYMENT_METHODS.includes(method))
          throw httpError(400, 'Enter a positive amount (up to two decimals) and a payment method.');
        const payment = {
          id: newId(), appointmentId: item.id, amount: Math.round(amount * 100), method,
          reference: clean(data.reference, 60), recordedAt: now(), recordedBy: user.id
        };
        db.payments.push(payment);
        persist();
        return send(res, 201, { appointment: appointmentView(db, item) });
      }

      // ── GET /api/report ───────────────────────────────────────────────────
      if (req.method === 'GET' && pathname === '/api/report') {
        requireUser(user, 'staff');
        const counts = Object.fromEntries(
          STATUSES.map(s => [s, db.appointments.filter(a => a.status === s).length])
        );
        return send(res, 200, {
          counts,
          amountCollected: db.payments.reduce((sum, p) => sum + p.amount, 0),
          paymentsRecorded: db.payments.length
        });
      }

      throw httpError(404, 'Page not found.');

    } catch (error) {
      if (!res.writableEnded && !res.destroyed)
        send(res, error.status || 500, { error: error.status ? error.message : 'Unexpected server error.' });
      if (!error.status) console.error(error);
    }
  };
}

module.exports = { createHandler };
