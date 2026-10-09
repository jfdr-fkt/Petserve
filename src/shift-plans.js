const { clean, httpError, validDate, manilaNow } = require('./helpers');
const { newId } = require('./db');

function activeEmployee(db, employeeId) {
  const employee = db.users.find(
    (item) => item.id === employeeId && item.role === 'staff' && !item.disabled,
  );
  if (!employee) throw httpError(400, 'Choose an active employee.');
  return employee;
}

function assignment(data, today = manilaNow().date) {
  if (typeof data.date !== 'string' || !validDate(data.date) || data.date < today)
    throw httpError(400, 'Choose today or a future shift date.');
  const kind = data.kind ?? 'work';
  if (!['work', 'rest', 'leave'].includes(kind))
    throw httpError(400, 'Choose a working shift, rest day or leave.');
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (
    kind === 'work' &&
    (typeof data.start !== 'string' ||
      typeof data.end !== 'string' ||
      !time.test(data.start) ||
      !time.test(data.end) ||
      data.start >= data.end)
  )
    throw httpError(400, 'Choose a same-day shift with an end time after its start.');
  return {
    date: data.date,
    kind,
    start: kind === 'work' ? data.start : '',
    end: kind === 'work' ? data.end : '',
    notes: clean(data.notes, 200),
  };
}

function shiftsConflict(left, right) {
  return (
    left.employeeId === right.employeeId &&
    left.date === right.date &&
    ((left.kind || 'work') !== 'work' ||
      (right.kind || 'work') !== 'work' ||
      (left.start < right.end && right.start < left.end))
  );
}

// Validate the entire month before replacing any dates. Other dates and employees
// retain their assignments, including multiple non-overlapping working shifts.
function applyMonthPlan(db, data) {
  activeEmployee(db, data.employeeId);
  if (
    typeof data.month !== 'string' ||
    !/^\d{4}-\d{2}$/.test(data.month) ||
    !validDate(`${data.month}-01`)
  )
    throw httpError(400, 'Choose a valid month.');
  if (!Array.isArray(data.changes) || !data.changes.length || data.changes.length > 31)
    throw httpError(400, 'Choose between 1 and 31 dates to update.');
  const today = manilaNow().date;
  const dates = new Set();
  const saved = data.changes.map((change) => {
    if (
      !change ||
      typeof change.date !== 'string' ||
      !validDate(change.date) ||
      change.date < today ||
      !change.date.startsWith(`${data.month}-`) ||
      dates.has(change.date)
    )
      throw httpError(400, 'Choose unique dates from the selected month, starting today.');
    dates.add(change.date);
    if (change.kind === 'clear') return null;
    const old = db.shifts.find(
      (shift) => shift.employeeId === data.employeeId && shift.date === change.date,
    );
    return { id: old?.id || newId(), employeeId: data.employeeId, ...assignment(change, today) };
  });
  db.shifts = [
    ...db.shifts.filter((shift) => shift.employeeId !== data.employeeId || !dates.has(shift.date)),
    ...saved.filter(Boolean),
  ];
  return dates.size;
}

module.exports = { activeEmployee, assignment, shiftsConflict, applyMonthPlan };
