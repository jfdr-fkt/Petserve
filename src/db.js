// src/db.js — Database seed, load, and persistence logic.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { SERVICES } = require('./config');
const { visitPetIds } = require('./visits');

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
    await migrate(db);
    fs.writeFileSync(file, JSON.stringify(db, null, 2) + '\n');
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
        passwordHash: demoHash,
      },
      {
        id: newId(),
        name: 'Clinic Staff',
        email: 'staff@petserve.test',
        role: 'staff',
        passwordHash: demoHash,
      },
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
        createdAt: now(),
      },
    ],
    healthLogs: [
      {
        id: newId(),
        petId: miloId,
        type: 'vaccine',
        title: '5-in-1 Core Vaccine',
        date: '2026-05-15',
        notes: 'Administered at Petopia Clinic.',
        createdAt: now(),
      },
      {
        id: newId(),
        petId: miloId,
        type: 'deworming',
        title: 'Routine Deworming',
        date: '2026-07-10',
        notes: 'Weight checked: 12 kg.',
        createdAt: now(),
      },
    ],
    appointments: [],
    payments: [],
  };

  await migrate(initial);
  fs.writeFileSync(file, JSON.stringify(initial, null, 2) + '\n', { flag: 'wx' });
  return initial;
}

async function migrate(db) {
  db.version = 5;
  db.healthLogs ||= [];
  db.services ||= SERVICES.map((service) => ({ ...service }));
  db.schedule ||= { weekdays: [0, 6], timeSlots: require('./config').TIME_SLOTS, blocked: [] };
  db.shifts ||= [];
  db.serviceRecords ||= [];
  db.feedback ||= [];
  db.gallery ||= [];
  db.chats ||= [];
  db.paymentRequests ||= [];
  db.wallets ||= Object.fromEntries(
    ['GCash', 'Maya'].map((method) => [
      method,
      { enabled: false, name: '', number: '', instructions: '' },
    ]),
  );
  if (!db.users.some((user) => user.role === 'admin')) {
    db.users.push({
      id: newId(),
      name: 'Clinic Administrator',
      email: 'admin@petserve.test',
      role: 'admin',
      passwordHash: await hashPassword('Petserve123!'),
    });
  }
  for (const appointment of db.appointments) {
    const service = db.services.find((s) => s.id === appointment.serviceId);
    appointment.serviceName ||= service?.name || 'Service';
    appointment.basePrice ??= service?.basePrice || 0;
    appointment.duration ||= service?.duration || 60;
    appointment.resource ||= service?.resource || 'veterinarian';
    appointment.petIds ||= [appointment.petId];
    appointment.unitPrice ??= appointment.basePrice;
    if (
      appointment.status === 'completed' &&
      !db.serviceRecords.some((record) => record.appointmentId === appointment.id)
    ) {
      db.serviceRecords.push({
        id: newId(),
        appointmentId: appointment.id,
        petId: appointment.petId,
        petIds: visitPetIds(appointment),
        notes: appointment.staffNote || '',
        recordedAt: appointment.createdAt,
        recordedBy: '',
      });
    }
  }
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
  const p = db.payments.find((item) => item.appointmentId === appointment.id);
  return p
    ? {
        id: p.id,
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        recordedAt: p.recordedAt,
        status: 'paid',
        recordedBy: db.users.find((user) => user.id === p.recordedBy)?.name || 'Clinic staff',
      }
    : null;
}

function appointmentView(db, appointment) {
  const pet = db.pets.find((item) => item.id === appointment.petId);
  const petIds = visitPetIds(appointment);
  const pets = petIds.map((id) => db.pets.find((p) => p.id === id)).filter(Boolean);
  const owner = db.users.find((item) => item.id === appointment.customerId);
  const service = db.services.find((item) => item.id === appointment.serviceId);
  return {
    id: appointment.id,
    date: appointment.date,
    time: appointment.time,
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName || service?.name || 'Service',
    basePrice: appointment.basePrice ?? service?.basePrice ?? 0,
    duration: appointment.duration || service?.duration || 60,
    resource: appointment.resource || service?.resource,
    petId: appointment.petId,
    petIds,
    petNames: pets.map((p) => p.name),
    petName: pets.map((p) => p.name).join(', ') || pet?.name || 'Pet',
    unitPrice: appointment.unitPrice ?? appointment.basePrice,
    customerName: owner?.name ?? 'Customer',
    customerId: appointment.customerId,
    status: appointment.status,
    note: appointment.note,
    staffNote: appointment.staffNote,
    createdAt: appointment.createdAt,
    serviceRecord:
      db.serviceRecords.find((record) => record.appointmentId === appointment.id) || null,
    payment: paymentView(db, appointment),
    paymentRequest:
      [...db.paymentRequests].reverse().find((r) => r.appointmentId === appointment.id) || null,
  };
}

const PUBLIC_USER = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone || '',
  disabled: Boolean(u.disabled),
});

module.exports = {
  seedDatabase,
  makePersist,
  hashPassword,
  verifyPassword,
  paymentView,
  appointmentView,
  PUBLIC_USER,
  newId,
  now,
};
