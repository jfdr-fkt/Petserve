const { send, readBody, requireUser, requireJson } = require('../http');
const { newId, now, appointmentView } = require('../db');
const { clean, httpError } = require('../helpers');
const { PAYMENT_METHODS } = require('../config');
const { assertSlot, assertPetFree } = require('../scheduling');

module.exports = async ({ req, res, pathname, db, user, persist }) => {
  if (pathname === '/api/appointments' && req.method === 'POST') {
    requireUser(user, 'customer');
    requireJson(req);
    const data = await readBody(req);
    const pet = db.pets.find((p) => p.id === data.petId && p.ownerId === user.id && !p.deletedAt);
    const service = db.services.find((s) => s.id === data.serviceId);
    if (!pet || !service) throw httpError(400, 'Choose your pet and a listed service.');
    assertSlot(db, service, data.date, data.time);
    assertPetFree(db, pet.id, data.date, data.time, service.duration);
    const appointment = {
      id: newId(),
      customerId: user.id,
      petId: pet.id,
      serviceId: service.id,
      serviceName: service.name,
      basePrice: service.basePrice,
      duration: service.duration,
      resource: service.resource,
      date: data.date,
      time: data.time,
      status: 'pending',
      note: clean(data.note, 300),
      staffNote: '',
      createdAt: now(),
    };
    db.appointments.push(appointment);
    persist();
    send(res, 201, { appointment: appointmentView(db, appointment) });
    return true;
  }
  const match =
    /^\/api\/appointments\/([a-f0-9-]+)\/(status|payment|online-payment|reschedule)$/.exec(
      pathname,
    );
  if (!match) return false;
  requireUser(user);
  const item = db.appointments.find((a) => a.id === match[1]);
  if (!item) throw httpError(404, 'Appointment not found.');
  if (user.role === 'customer' && item.customerId !== user.id)
    throw httpError(403, 'Access denied.');
  if (match[2] === 'online-payment')
    throw httpError(403, 'Payments are recorded by clinic staff after your visit.');
  const paid = db.payments.some((p) => p.appointmentId === item.id);
  const service = db.services.find((s) => s.id === item.serviceId);
  if (match[2] === 'status' && req.method === 'PATCH') {
    requireJson(req);
    const data = await readBody(req),
      next = clean(data.status, 20);
    if (user.role === 'customer') {
      if (!['pending', 'confirmed'].includes(item.status) || paid || next !== 'cancelled')
        throw httpError(403, 'You can cancel only your own unpaid upcoming appointment.');
    } else {
      const allowed =
        item.status === 'pending'
          ? ['confirmed', 'rejected']
          : item.status === 'confirmed'
            ? ['completed', 'cancelled']
            : [];
      if (!allowed.includes(next)) throw httpError(409, 'That status change is not available.');
      if (next === 'confirmed') {
        assertSlot(
          db,
          {
            ...service,
            duration: item.duration || service.duration,
            resource: item.resource || service.resource,
          },
          item.date,
          item.time,
          item.id,
        );
        if (db.pets.find((p) => p.id === item.petId)?.deletedAt)
          throw httpError(409, 'This pet has been archived.');
      }
      if (next === 'cancelled' && paid) throw httpError(409, 'This visit has a payment record.');
      item.staffNote = clean(data.staffNote, 300);
      if (next === 'completed')
        db.serviceRecords.push({
          id: newId(),
          appointmentId: item.id,
          petId: item.petId,
          notes: clean(data.serviceNotes, 1000) || item.staffNote,
          recordedAt: now(),
          recordedBy: user.id,
        });
    }
    item.status = next;
    persist();
    send(res, 200, { appointment: appointmentView(db, item) });
    return true;
  }
  if (match[2] === 'reschedule' && req.method === 'PATCH') {
    requireJson(req);
    if (!['pending', 'confirmed'].includes(item.status) || paid)
      throw httpError(409, 'Only unpaid upcoming visits can be rescheduled.');
    const data = await readBody(req);
    assertSlot(
      db,
      {
        ...service,
        duration: item.duration || service.duration,
        resource: item.resource || service.resource,
      },
      data.date,
      data.time,
      item.id,
    );
    assertPetFree(db, item.petId, data.date, data.time, item.duration || service.duration, item.id);
    item.date = data.date;
    item.time = data.time;
    item.status = 'pending';
    item.staffNote = '';
    persist();
    send(res, 200, { appointment: appointmentView(db, item) });
    return true;
  }
  if (match[2] === 'payment' && req.method === 'POST') {
    requireUser(user, ['staff', 'admin']);
    requireJson(req);
    if (item.status !== 'completed' || paid)
      throw httpError(
        409,
        paid
          ? 'Payment has already been recorded.'
          : 'Complete the service before recording payment.',
      );
    const data = await readBody(req),
      amount = Number(data.amount),
      method = clean(data.method, 30);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1000000 ||
      Math.round(amount * 100) / 100 !== amount ||
      !PAYMENT_METHODS.includes(method)
    )
      throw httpError(400, 'Enter a positive amount with up to two decimals and a listed method.');
    db.payments.push({
      id: newId(),
      appointmentId: item.id,
      amount: Math.round(amount * 100),
      method,
      reference: clean(data.reference, 60),
      recordedAt: now(),
      recordedBy: user.id,
    });
    persist();
    send(res, 201, { appointment: appointmentView(db, item) });
    return true;
  }
  return false;
};
