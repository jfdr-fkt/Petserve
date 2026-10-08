import { state } from './state.js';
import { button, field } from './components.js';
import { escapeHTML as e, todayManila, dateLabel, timeLabel } from './utils.js';

export function shiftPanel(date, admin) {
  const shifts = state.data.shifts
    .filter((shift) => shift.date === date)
    .sort((a, b) => a.start.localeCompare(b.start));
  const upcoming =
    !admin &&
    state.data.shifts
      .filter((shift) => shift.date > date && shift.date >= todayManila())
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
      .slice(0, 3);
  const row = (shift, future = false) =>
    `<div class="payment-row"><div><strong>${admin ? e(state.data.users.find((user) => user.id === shift.employeeId)?.name || 'Employee') : future ? dateLabel(shift.date) : 'Your assigned shift'}</strong><small>${timeLabel(shift.start)} – ${timeLabel(shift.end)} · Asia/Manila</small>${shift.notes ? `<p class="shift-notes">${e(shift.notes)}</p>` : ''}</div>${admin ? `<div class="actions">${button('Edit', 'shift-edit', 'edit', 'outline', `data-id="${shift.id}"`)}${button('Remove', 'shift-remove', '', 'outline', `data-id="${shift.id}"`)}</div>` : ''}</div>`;
  return `<section class="panel shift-panel"><div class="panel-header"><div><h2>${admin ? 'Employee shifts' : 'Your shifts'}</h2><p>${admin ? 'Assign working hours for the selected date.' : 'Your administrator assigns these working hours.'}</p></div>${admin ? button('Assign shift', 'shift-add', 'plus', 'soft') : ''}</div>${shifts.length ? shifts.map((shift) => row(shift)).join('') : '<p class="panel-empty-note">No shifts assigned for this date.</p>'}${upcoming?.length ? `<h3 class="shift-upcoming-title">Coming up</h3>${upcoming.map((shift) => row(shift, true)).join('')}` : ''}</section>`;
}

export function shiftDialog(type, id, draft) {
  if (!['shift', 'shift-remove'].includes(type)) return null;
  if (type === 'shift-remove') {
    const shift = state.data.shifts.find((item) => item.id === id);
    return {
      title: 'Remove this shift?',
      description: `${dateLabel(shift.date)} · ${timeLabel(shift.start)} – ${timeLabel(shift.end)}`,
      content:
        '<p>This removes the assigned working hours. Clinic appointments stay on the calendar.</p>',
      label: 'Remove shift',
    };
  }
  const employees = state.data.users.filter((user) => user.role === 'staff' && !user.disabled);
  return {
    title: id ? 'Update working hours.' : 'Plan a shift.',
    description: 'Employees can view their shifts. Only administrators can edit them.',
    content: `${field('Employee', 'employeeId', draft.employeeId, { choices: [['', 'Select an employee'], ...employees.map((user) => [user.id, user.name])], required: true })}${field('Shift date', 'date', draft.date || state.scheduleDate || todayManila(), { type: 'date', required: true, attrs: `min="${todayManila()}"` })}<div class="form-grid">${field('Starts at', 'start', draft.start || '09:00', { type: 'time', required: true })}${field('Ends at', 'end', draft.end || '17:00', { type: 'time', required: true })}</div>${field('Notes (optional)', 'notes', draft.notes, { type: 'textarea', attrs: 'maxlength="200"', placeholder: 'Team assignment or a reminder for this shift.' })}`,
    label: id ? 'Save shift' : 'Assign shift',
  };
}
