const { send, readBody, requireUser, requireJson } = require('../http');
const { clean, httpError, validDate, manilaNow } = require('../helpers');
const { newId } = require('../db');
const { slotReason, overlaps, resourceOf, durationOf } = require('../scheduling');
const { STATUSES } = require('../config');

module.exports = async ({ req, res, pathname, url, db, user, persist }) => {
  if (req.method === 'GET' && pathname === '/api/availability') {
    requireUser(user);
    const date = url.searchParams.get('date'),
      service = db.services.find((s) => s.id === url.searchParams.get('serviceId'));
    if (!validDate(date) || !service) throw httpError(400, 'Choose a valid date and service.');
    const ignoreId = url.searchParams.get('appointmentId') || '';
    const appointment = ignoreId && db.appointments.find((a) => a.id === ignoreId);
    if (ignoreId && !appointment) throw httpError(404, 'Appointment not found.');
    if (appointment && user.role === 'customer' && appointment.customerId !== user.id)
      throw httpError(403, 'Access denied.');
    const selected = appointment
      ? {
          ...service,
          duration: appointment.duration || service.duration,
          resource: appointment.resource || service.resource,
        }
      : service;
    send(res, 200, {
      slots: db.schedule.timeSlots.map((time) => {
        const reason = slotReason(db, selected, date, time, ignoreId);
        return { time, available: !reason, reason };
      }),
    });
    return true;
  }
  if (pathname === '/api/schedule' && req.method === 'PATCH') {
    requireUser(user, ['staff', 'admin']);
    requireJson(req);
    const data = await readBody(req);
    if (
      !Array.isArray(data.weekdays) ||
      !data.weekdays.length ||
      data.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      !Array.isArray(data.timeSlots) ||
      !data.timeSlots.length ||
      data.timeSlots.length > 24 ||
      data.timeSlots.some((time) => !/^(09|1[0-6]):[03]0$/.test(time))
    )
      throw httpError(400, 'Choose open days and valid half-hour slots between 9 AM and 4:30 PM.');
    if (
      db.appointments.some(
        (a) =>
          a.status === 'confirmed' &&
          a.date >= manilaNow().date &&
          (!data.weekdays.includes(new Date(`${a.date}T00:00:00Z`).getUTCDay()) ||
            !data.timeSlots.includes(a.time)),
      )
    )
      throw httpError(409, 'Reschedule confirmed visits before removing their open day or time.');
    db.schedule.weekdays = [...new Set(data.weekdays)].sort();
    db.schedule.timeSlots = [...new Set(data.timeSlots)].sort();
    persist();
    send(res, 200, { schedule: db.schedule });
    return true;
  }
  if (pathname === '/api/schedule/blocks' && req.method === 'POST') {
    requireUser(user, ['staff', 'admin']);
    requireJson(req);
    const data = await readBody(req);
    if (
      !validDate(data.date) ||
      data.date < manilaNow().date ||
      !['groomer', 'veterinarian'].includes(data.resource) ||
      (data.time && !db.schedule.timeSlots.includes(data.time))
    )
      throw httpError(400, 'Choose a future date, care team and listed time.');
    if (
      db.appointments.some(
        (a) =>
          a.status === 'confirmed' &&
          a.date === data.date &&
          resourceOf(db, a) === data.resource &&
          (!data.time || overlaps(a.time, durationOf(db, a), data.time, 60)),
      )
    )
      throw httpError(409, 'Reschedule confirmed visits before blocking this time.');
    if (
      db.schedule.blocked.some(
        (b) => b.date === data.date && b.resource === data.resource && b.time === (data.time || ''),
      )
    )
      throw httpError(409, 'This time is already blocked.');
    db.schedule.blocked.push({
      id: newId(),
      date: data.date,
      resource: data.resource,
      time: data.time || '',
      reason: clean(data.reason, 120),
    });
    persist();
    send(res, 201, { schedule: db.schedule });
    return true;
  }
  const block = /^\/api\/schedule\/blocks\/([a-f0-9-]+)$/.exec(pathname);
  if (block && req.method === 'DELETE') {
    requireUser(user, ['staff', 'admin']);
    db.schedule.blocked = db.schedule.blocked.filter((b) => b.id !== block[1]);
    persist();
    send(res, 200, { ok: true });
    return true;
  }
  const serviceRoute = /^\/api\/services\/([a-z-]+)$/.exec(pathname);
  if (serviceRoute && req.method === 'PATCH') {
    requireUser(user, ['staff', 'admin']);
    requireJson(req);
    const service = db.services.find((s) => s.id === serviceRoute[1]);
    if (!service) throw httpError(404, 'Service not found.');
    const data = await readBody(req),
      price = Number(data.price),
      duration = data.duration === undefined ? service.duration : Number(data.duration);
    if (
      !clean(data.name, 80) ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 1000000 ||
      Math.round(price * 100) / 100 !== price ||
      ![30, 60, 90, 120].includes(duration) ||
      typeof data.active !== 'boolean'
    )
      throw httpError(400, 'Enter a service name, valid price and duration.');
    Object.assign(service, {
      name: clean(data.name, 80),
      description: clean(data.description, 300),
      basePrice: Math.round(price * 100),
      duration,
      active: data.active,
    });
    persist();
    send(res, 200, { service });
    return true;
  }
  if (pathname === '/api/report' && req.method === 'GET') {
    requireUser(user, ['staff', 'admin']);
    const from = url.searchParams.get('from') || '',
      to = url.searchParams.get('to') || '';
    if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to))
      throw httpError(400, 'Choose a valid report date range.');
    const appointments = db.appointments.filter(
      (a) => (!from || a.date >= from) && (!to || a.date <= to),
    );
    const ids = new Set(appointments.map((a) => a.id)),
      payments = db.payments.filter((p) => ids.has(p.appointmentId));
    send(res, 200, {
      counts: Object.fromEntries(
        STATUSES.map((status) => [status, appointments.filter((a) => a.status === status).length]),
      ),
      totalAppointments: appointments.length,
      servicesCompleted: db.serviceRecords.filter((r) => ids.has(r.appointmentId)).length,
      amountCollected: payments.reduce((sum, p) => sum + p.amount, 0),
      paymentsRecorded: payments.length,
      outstanding: appointments.filter(
        (a) => a.status === 'completed' && !payments.some((p) => p.appointmentId === a.id),
      ).length,
      services: db.services.map((s) => ({
        name: s.name,
        bookings: appointments.filter((a) => a.serviceId === s.id).length,
        completed: appointments.filter((a) => a.serviceId === s.id && a.status === 'completed')
          .length,
        collected: payments
          .filter((p) => appointments.find((a) => a.id === p.appointmentId)?.serviceId === s.id)
          .reduce((sum, p) => sum + p.amount, 0),
      })),
    });
    return true;
  }
  return false;
};
