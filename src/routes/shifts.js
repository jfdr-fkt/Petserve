const { send, readBody, requireUser, requireJson } = require('../http');
const { httpError } = require('../helpers');
const { newId } = require('../db');
const { activeEmployee, assignment, shiftsConflict, applyMonthPlan } = require('../shift-plans');

module.exports = async ({ req, res, pathname, db, user, persist }) => {
  if (pathname === '/api/schedule/shifts/month' && req.method === 'POST') {
    requireUser(user, 'admin');
    requireJson(req);
    const updated = applyMonthPlan(db, await readBody(req));
    persist();
    send(res, 200, { ok: true, updated });
    return true;
  }
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
    const employee = activeEmployee(db, data.employeeId);
    const saved = { employeeId: employee.id, ...assignment(data) };
    if (db.shifts.some((item) => item.id !== id && shiftsConflict(item, saved)))
      throw httpError(409, 'This employee already has a conflicting assignment for this date.');
    if (shift) Object.assign(shift, saved);
    else db.shifts.push({ id: newId(), ...saved });
    persist();
    send(res, shift ? 200 : 201, { ok: true });
    return true;
  }
  return false;
};
