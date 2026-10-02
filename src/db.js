// src/db.js — Database seed, load, and persistence logic.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { SERVICES } = require('./config');

const scrypt = promisify(crypto.scrypt);

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ─── Password Hashing ────────────────────────────────────────────────────────

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

// ─── Seed & Load ─────────────────────────────────────────────────────────────

async function seedDatabase(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (fs.existsSync(file)) {
    const db = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Migrate older databases that lack new fields
    if (!db.healthLogs) db.healthLogs = [];
    return db;
  }

  const demoHash = await hashPassword('Petserve123!');
  const ownerId = newId();
  const miloId = newId();

  const initial = {
    version: 1,
    users: [
      {
        id: ownerId,
        name: 'Alex Rivera',
        email: 'alex@example.test',
        role: 'customer',
        passwordHash: demoHash
      },
      {
        id: newId(),
        name: 'Clinic Staff',
        email: 'staff@petserve.test',
        role: 'staff',
        passwordHash: demoHash
      }
    ],
    pets: [
      {
        id: miloId,
        ownerId: ownerId,
        name: 'Milo',
        species: 'Dog',
        breed: 'Aspin',
        age: '2 years',
        notes: 'Friendly dog, gets anxious during hair drying.',
        photoUrl: '',
        createdAt: now()
      }
    ],
    healthLogs: [
      {
        id: newId(),
        petId: miloId,
        type: 'vaccine',
        title: '5-in-1 Core Vaccine',
        date: '2026-05-15',
        notes: 'Administered at Petopia Clinic.',
        createdAt: now()
      },
      {
        id: newId(),
        petId: miloId,
        type: 'deworming',
        title: 'Routine Deworming',
        date: '2026-07-10',
        notes: 'Weight checked: 12 kg.',
        createdAt: now()
      }
    ],
    appointments: [],
    payments: []
  };

  fs.writeFileSync(file, JSON.stringify(initial, null, 2) + '\n', { flag: 'wx' });
  return initial;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function makePersist(db, dbFile) {
  return function persist() {
    const tmp = `${dbFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + '\n');
    fs.renameSync(tmp, dbFile);
  };
}

// ─── View Projections ────────────────────────────────────────────────────────

function paymentView(db, appointment) {
  const p = db.payments.find(item => item.appointmentId === appointment.id);
  return p
    ? { id: p.id, amount: p.amount, method: p.method, reference: p.reference, recordedAt: p.recordedAt }
    : null;
}

function appointmentView(db, appointment) {
  const pet = db.pets.find(item => item.id === appointment.petId);
  const owner = db.users.find(item => item.id === appointment.customerId);
  const service = SERVICES.find(item => item.id === appointment.serviceId);
  return {
    id: appointment.id,
    date: appointment.date,
    time: appointment.time,
    serviceId: appointment.serviceId,
    serviceName: service?.name ?? 'Service',
    petId: appointment.petId,
    petName: pet?.name ?? 'Pet',
    customerName: owner?.name ?? 'Customer',
    status: appointment.status,
    note: appointment.note,
    staffNote: appointment.staffNote,
    createdAt: appointment.createdAt,
    payment: paymentView(db, appointment)
  };
}

const PUBLIC_USER = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });

module.exports = {
  seedDatabase, makePersist,
  hashPassword, verifyPassword,
  paymentView, appointmentView, PUBLIC_USER,
  newId, now
};
