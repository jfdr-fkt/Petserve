const { send, readBody, requireUser, requireJson } = require('../http');
const { clean, httpError, validDate, manilaNow } = require('../helpers');
const { newId } = require('../db');

module.exports = async ({ req, res, pathname, db, user, persist }) => {
  const match = /^\/api\/schedule\/shifts(?:\/([a-f0-9-]+))?$/.exec(pathname);
  if (!match) return false;
  requireUser(user, 'admin');
  const id = match[1];
  const shift = id && db.shifts.find((item) => item.id === id);
  if (id && !shift) throw httpError(404, 'Shift not found.');
  if (id && req.method === 'DELETE') {
    db.shifts = db.shifts.filter((item) => item.id !== id);
    persist();
    send(res, 200, { ok: true });
    return true;
  }
  if ((!id && req.method === 'POST') || (id && req.method === 'PATCH')) {
    requireJson(req);
    const data = await readBody(req);
    const employee = db.users.find(
      (item) => item.id === data.employeeId && item.role === 'staff' && !item.disabled,
    );
    if (!employee) throw httpError(400, 'Choose an active employee.');
    if (typeof data.date !== 'string' || !validDate(data.date) || data.date < manilaNow().date)
      throw httpError(400, 'Choose today or a future shift date.');
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (
      typeof data.start !== 'string' ||
      typeof data.end !== 'string' ||
      !time.test(data.start) ||
      !time.test(data.end) ||
      data.start >= data.end
    )
      throw httpError(400, 'Choose a same-day shift with an end time after its start.');
    if (
      db.shifts.some(
        (item) =>
          item.id !== id &&
          item.employeeId === employee.id &&
          item.date === data.date &&
          item.start < data.end &&
          data.start < item.end,
      )
    )
      throw httpError(409, 'This employee already has an overlapping shift.');
    const saved = {
      employeeId: employee.id,
      date: data.date,
      start: data.start,
      end: data.end,
      notes: clean(data.notes, 200),
    };
    if (shift) Object.assign(shift, saved);
    else db.shifts.push({ id: newId(), ...saved });
    persist();
    send(res, shift ? 200 : 201, { ok: true });
    return true;
  }
  return false;
};
