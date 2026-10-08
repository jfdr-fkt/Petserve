const { send, readBody, requireUser, requireJson } = require('../http');
const { httpError, clean, validDate } = require('../helpers');
const { newId, now, appointmentView } = require('../db');
const { selectCarePlan, arrangeCarePlan, carePlanPreview } = require('../care-plans');
const { assertSlot, assertPetFree } = require('../scheduling');
const { visitPetIds } = require('../visits');

module.exports = async ({ req, res, pathname, db, user, persist }) => {
  if (
    req.method === 'POST' &&
    ['/api/care-plans/availability', '/api/care-plans'].includes(pathname)
  ) {
    requireUser(user, 'customer');
    requireJson(req);
    const data = await readBody(req);
    if (!db.users.includes(user) || user.disabled)
      throw httpError(403, 'Sign in again to request care.');
    requireUser(user, 'customer');
    if (!validDate(data.date)) throw httpError(400, 'Choose a valid care date.');
    const tasks = selectCarePlan(db, user, data.items);
    if (pathname.endsWith('/availability')) {
      const slots = db.schedule.timeSlots.map((time) => {
        try {
          return {
            time,
            available: true,
            appointments: carePlanPreview(arrangeCarePlan(db, tasks, data.date, time)),
          };
        } catch (error) {
          if (error.status !== 409) throw error;
          return { time, available: false, reason: error.message };
        }
      });
      send(res, 200, { slots });
      return true;
    }
    const planned = arrangeCarePlan(db, tasks, data.date, data.time);
    const carePlanId = newId(),
      stamp = now();
    const appointments = planned.map(({ pets, service, date, time }) => ({
      id: newId(),
      carePlanId,
      arrivalTime: data.time,
      customerId: user.id,
      petId: pets[0].id,
      petIds: pets.map((pet) => pet.id),
      serviceId: service.id,
      serviceName: service.name,
      basePrice: service.basePrice * pets.length,
      unitPrice: service.basePrice,
      duration: service.duration,
      resource: service.resource,
      date,
      time,
      status: 'pending',
      note: clean(data.note, 300),
      staffNote: '',
      createdAt: stamp,
    }));
    db.appointments.push(...appointments);
    try {
      persist();
    } catch (error) {
      db.appointments.splice(db.appointments.length - appointments.length);
      throw error;
    }
    send(res, 201, {
      carePlanId,
      appointments: appointments.map((item) => appointmentView(db, item)),
    });
    return true;
  }
  const match = /^\/api\/care-plans\/([a-f0-9-]+)\/status$/.exec(pathname);
  if (!match || req.method !== 'PATCH') return false;
  requireUser(user);
  requireJson(req);
  const data = await readBody(req);
  if (!db.users.includes(user) || user.disabled)
    throw httpError(403, 'Sign in again to review this request.');
  const parts = db.appointments.filter((item) => item.carePlanId === match[1]);
  if (!parts.length) throw httpError(404, 'Care request not found.');
  if (user.role === 'customer' && parts.some((item) => item.customerId !== user.id))
    throw httpError(403, 'Access denied.');
  if (
    !['confirmed', 'rejected', 'cancelled'].includes(data.status) ||
    (user.role === 'customer' && data.status !== 'cancelled')
  )
    throw httpError(403, 'That care request action is not available.');
  const active = parts.filter((item) => ['pending', 'confirmed'].includes(item.status));
  if (
    !active.length ||
    (data.status !== 'cancelled' && active.length !== parts.length) ||
    (data.status !== 'cancelled' && active.some((item) => item.status !== 'pending'))
  )
    throw httpError(
      409,
      'This request has already been reviewed. Manage its individual services instead.',
    );
  if (active.some((item) => db.payments.some((payment) => payment.appointmentId === item.id)))
    throw httpError(409, 'Paid services cannot be cancelled.');
  if (data.status === 'confirmed') {
    const working = {
      ...db,
      appointments: db.appointments.filter((item) => !active.includes(item)),
    };
    for (const item of active) {
      if (visitPetIds(item).some((id) => !db.pets.some((pet) => pet.id === id && !pet.deletedAt)))
        throw httpError(409, 'One of these pets is no longer active.');
      const service = {
        ...db.services.find((entry) => entry.id === item.serviceId),
        duration: item.duration,
        resource: item.resource,
      };
      assertSlot(working, service, item.date, item.time);
      for (const id of visitPetIds(item))
        assertPetFree(working, id, item.date, item.time, item.duration);
      working.appointments.push({ ...item, status: 'confirmed' });
    }
  }
  const before = active.map((item) => ({ ...item }));
  active.forEach((item) =>
    Object.assign(item, {
      status: data.status,
      ...(user.role !== 'customer' ? { staffNote: clean(data.staffNote, 300) } : {}),
    }),
  );
  try {
    persist();
  } catch (error) {
    active.forEach((item, index) => Object.assign(item, before[index]));
    throw error;
  }
  send(res, 200, { appointments: parts.map((item) => appointmentView(db, item)) });
  return true;
};
