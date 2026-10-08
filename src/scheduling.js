const { validDate, manilaNow, httpError } = require('./helpers');
const { visitPetIds } = require('./visits');

const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const resourceOf = (db, appointment) =>
  appointment.resource || db.services.find((s) => s.id === appointment.serviceId)?.resource;
const durationOf = (db, appointment) =>
  appointment.duration || db.services.find((s) => s.id === appointment.serviceId)?.duration || 60;
const overlaps = (time, duration, otherTime, otherDuration) =>
  minutes(time) < minutes(otherTime) + otherDuration &&
  minutes(otherTime) < minutes(time) + duration;

function slotReason(db, service, date, time, ignoreId = '') {
  if (!service || !service.active) return 'This service is currently unavailable.';
  if (!validDate(date) || !db.schedule.timeSlots.includes(time))
    return 'Choose a listed date and time.';
  const present = manilaNow();
  const days = (Date.parse(date) - Date.parse(present.date)) / 86400000;
  if (days < 0 || days > 90 || (days === 0 && time <= present.time))
    return 'Choose a future visit within 90 days.';
  if (!db.schedule.weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay()))
    return 'The clinic is closed on this day.';
  if (minutes(time) + service.duration > 17 * 60) return 'This service would finish after closing.';
  if (
    db.schedule.blocked.some(
      (slot) =>
        slot.date === date &&
        slot.resource === service.resource &&
        (!slot.time || overlaps(time, service.duration, slot.time, 60)),
    )
  )
    return 'This care team is unavailable at this time.';
  if (
    db.appointments.some(
      (a) =>
        a.id !== ignoreId &&
        a.date === date &&
        ['confirmed', 'completed'].includes(a.status) &&
        resourceOf(db, a) === service.resource &&
        overlaps(time, service.duration, a.time, durationOf(db, a)),
    )
  )
    return 'Another booking already uses that care team and time.';
  return '';
}

function assertSlot(db, service, date, time, ignoreId = '') {
  const reason = slotReason(db, service, date, time, ignoreId);
  if (reason) throw httpError(409, reason);
}

function assertPetFree(db, petId, date, time, duration, ignoreId = '') {
  if (
    db.appointments.some(
      (a) =>
        a.id !== ignoreId &&
        visitPetIds(a).includes(petId) &&
        a.date === date &&
        ['pending', 'confirmed'].includes(a.status) &&
        overlaps(time, duration, a.time, durationOf(db, a)),
    )
  )
    throw httpError(409, 'This pet already has a visit request at that time.');
}

module.exports = { slotReason, assertSlot, assertPetFree, overlaps, resourceOf, durationOf };
