export const monthLabel = (month) =>
  new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );

export function monthDates(month) {
  const [year, number] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
  );
}

export const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function moveMonth(month, offset) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export const shiftKindLabel = (kind) =>
  ({ work: 'Working shift', rest: 'Rest day', leave: 'Leave', clear: 'Unassigned' })[
    kind || 'work'
  ];
