import { state } from './state.js';
import { field, icon, button } from './components.js';
import { escapeHTML as e, todayManila, dateLabel, timeLabel } from './utils.js';
import { monthDates, monthLabel, moveMonth, weekday, shiftKindLabel } from './calendar-dates.js';
import { monthPlan, planAssignments, shiftPlanner, handlePlanClick } from './shift-planner.js';

export function scheduleContext() {
  const admin = state.data.user.role === 'admin';
  const employees = admin
    ? state.data.users.filter((user) => user.role === 'staff' && !user.disabled)
    : [];
  state.scheduleMonth ||= (state.scheduleDate || todayManila()).slice(0, 7);
  state.scheduleMode ||= 'shifts';
  if (admin && !employees.some((user) => user.id === state.scheduleEmployeeId))
    state.scheduleEmployeeId = employees[0]?.id || '';
  const employeeId = admin ? state.scheduleEmployeeId : state.data.user.id;
  const plan =
    admin && state.scheduleMode === 'shifts' ? monthPlan(employeeId, state.scheduleMonth) : null;
  return {
    admin,
    employees,
    employeeId,
    plan,
    month: state.scheduleMonth,
    mode: state.scheduleMode,
  };
}

export function scheduleCalendar() {
  const { admin, employees, employeeId, plan, month, mode } = scheduleContext();
  const dates = monthDates(month),
    today = todayManila();
  const year = Number(month.slice(0, 4)),
    selectedMonth = Number(month.slice(5));
  const months = Array.from({ length: 12 }, (_, index) => [
    String(index + 1).padStart(2, '0'),
    new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, index, 1)),
    ),
  ]);
  const years = Array.from({ length: 7 }, (_, index) => String(year - 3 + index));
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const assignments = dates.flatMap((date) => planAssignments(date, employeeId, plan));
  const working = new Set(
    assignments.filter((shift) => (shift.kind || 'work') === 'work').map((shift) => shift.date),
  ).size;
  const rest = assignments.filter((shift) => shift.kind === 'rest').length;
  const leave = assignments.filter((shift) => shift.kind === 'leave').length;
  const visits = state.data.appointments.filter(
    (visit) =>
      visit.date.startsWith(`${month}-`) &&
      ['pending', 'confirmed', 'completed'].includes(visit.status),
  );
  return `<div class="schedule-view-toolbar"><div class="schedule-mode-tabs" aria-label="Schedule view">${[
    ['visits', 'Clinic visits'],
    ['shifts', admin ? 'Staff shifts' : 'My shifts'],
  ]
    .map(
      ([id, label]) =>
        `<button type="button" data-action="schedule-mode" data-mode="${id}" aria-pressed="${mode === id}">${icon(id === 'visits' ? 'pets' : 'calendar')}${label}</button>`,
    )
    .join(
      '',
    )}</div>${admin && mode === 'shifts' ? `<div class="calendar-employee">${field('Employee', 'scheduleEmployeeId', employeeId, { id: 'schedule-employee', choices: employees.length ? employees.map((user) => [user.id, user.name]) : [['', 'No active employees']] })}</div>` : ''}</div>
  <div class="schedule-workspace ${plan ? 'has-planner' : ''}"><section class="panel month-calendar" aria-label="${e(monthLabel(month))} calendar"><header class="calendar-header"><div><h2>${monthLabel(month)}</h2><p class="calendar-month-summary">${mode === 'visits' ? `${visits.length} clinic ${visits.length === 1 ? 'visit' : 'visits'}` : `${working} workdays · ${rest} rest days · ${leave} leave`}</p></div><div class="calendar-navigation">${button('Today', 'schedule-today', '', 'outline')}<button type="button" class="icon-button calendar-previous" data-action="calendar-month" data-offset="-1" aria-label="Previous month">${icon('arrow')}</button><button type="button" class="icon-button" data-action="calendar-month" data-offset="1" aria-label="Next month">${icon('arrow')}</button></div></header>
  <div class="calendar-month-controls">${field('Month', 'calendarMonth', String(selectedMonth).padStart(2, '0'), { id: 'calendar-month', choices: months })}${field('Year', 'calendarYear', String(year), { id: 'calendar-year', choices: years })}<span>Asia/Manila</span></div>
  <div class="calendar-week-header" aria-hidden="true">${dayNames.map((name) => `<span>${name}</span>`).join('')}</div><div class="calendar-days" role="group" aria-label="${e(monthLabel(month))} dates">${Array.from({ length: weekday(dates[0]) }, () => '<span class="calendar-blank" aria-hidden="true"></span>').join('')}${dates
    .map((date) => {
      const entries = planAssignments(date, employeeId, plan);
      const entry = entries[0];
      const kind = entry?.kind || 'work';
      const count = visits.filter((visit) => visit.date === date).length;
      const selected = plan?.selected.includes(date) || false;
      const changed = Boolean(plan && Object.hasOwn(plan.changes, date));
      const active = date === (state.scheduleDate || today);
      const canSelect = Boolean(plan && date >= today && !plan.saving);
      const hours =
        entry && kind === 'work'
          ? `${timeLabel(entry.start).replace(':00', '')}–${timeLabel(entry.end).replace(':00', '')}`
          : shiftKindLabel(kind);
      const description =
        mode === 'visits'
          ? `${count} ${count === 1 ? 'visit' : 'visits'}`
          : entries.length > 1
            ? `${entries.length} shifts`
            : entry
              ? `${shiftKindLabel(kind)}${kind === 'work' ? `, ${hours}` : ''}${entry.notes ? `, ${entry.notes}` : ''}`
              : 'Unassigned';
      const closed = !state.data.schedule.weekdays.includes(weekday(date));
      return `<button type="button" class="calendar-day ${active && !plan ? 'active' : ''} ${selected ? 'selected' : ''} ${date === today ? 'is-today' : ''} ${changed ? 'has-draft' : ''} ${plan && date < today ? 'past-date' : ''}" data-action="calendar-day" data-calendar-date="${date}" aria-label="${e(dateLabel(date))}, ${e(description)}" ${plan ? `aria-pressed="${selected}"` : ''} ${date === today ? 'aria-current="date"' : ''} ${plan?.saving ? 'disabled' : ''}><span class="calendar-day-top"><strong>${Number(date.slice(-2))}</strong>${canSelect ? `<span class="calendar-check" aria-hidden="true">${selected ? icon('check') : ''}</span>` : date === today ? '<span class="calendar-today-dot" aria-hidden="true"></span>' : ''}</span>${mode === 'visits' ? `<span class="calendar-visit-count ${count ? 'has-visits' : ''}">${count ? `<strong>${count}</strong><span class="calendar-day-detail">${count === 1 ? 'visit' : 'visits'}</span>` : `<span class="calendar-day-detail">${closed ? 'Closed' : 'No visits'}</span>`}</span>` : entry ? `<span class="calendar-assignment ${kind}"><span class="calendar-status-dot" aria-hidden="true"></span><span class="calendar-day-detail">${entries.length > 1 ? `${entries.length} shifts` : hours}</span><span class="calendar-day-short">${kind === 'work' ? 'Work' : kind === 'rest' ? 'Rest' : 'Leave'}</span></span>${entry.notes ? `<span class="calendar-note">${e(entry.notes)}</span>` : ''}` : '<span class="calendar-unassigned calendar-day-detail">Unassigned</span>'}${changed ? '<span class="calendar-draft-indicator" aria-label="Unsaved change"></span>' : ''}</button>`;
    })
    .join(
      '',
    )}</div><footer class="calendar-legend">${mode === 'shifts' ? '<span><i class="calendar-status-dot work"></i>Working</span><span><i class="calendar-status-dot rest"></i>Rest day</span><span><i class="calendar-status-dot leave"></i>Leave</span>' : '<span><i class="calendar-status-dot work"></i>Clinic visits</span>'}${plan ? '<span><i class="calendar-draft-dot"></i>Unsaved</span>' : ''}</footer></section>${admin && mode === 'shifts' ? shiftPlanner(plan) : ''}</div>`;
}

function selectMonth(month) {
  state.scheduleMonth = month;
  if (!(state.scheduleDate || todayManila()).startsWith(`${month}-`))
    state.scheduleDate = month === todayManila().slice(0, 7) ? todayManila() : `${month}-01`;
}

export async function handleScheduleClick(button, render, refresh) {
  if (await handlePlanClick(button, render, refresh)) return true;
  const action = button.dataset.action;
  if (!['schedule-mode', 'schedule-today', 'calendar-month', 'calendar-day'].includes(action))
    return false;
  if (action === 'schedule-mode') state.scheduleMode = button.dataset.mode;
  if (action === 'schedule-today') {
    state.scheduleDate = todayManila();
    selectMonth(todayManila().slice(0, 7));
  }
  if (action === 'calendar-month')
    selectMonth(moveMonth(state.scheduleMonth, Number(button.dataset.offset)));
  if (action === 'calendar-day') {
    const date = button.dataset.calendarDate;
    state.scheduleDate = date;
    const { plan } = scheduleContext();
    if (plan && date >= todayManila() && !plan.saving)
      plan.selected = plan.selected.includes(date)
        ? plan.selected.filter((item) => item !== date)
        : [...plan.selected, date];
  }
  render();
  if (action === 'calendar-day')
    document
      .querySelector(`[data-calendar-date="${button.dataset.calendarDate}"]`)
      ?.focus({ preventScroll: true });
  return true;
}

export function handleScheduleChange(target, render) {
  if (
    !['schedule-employee', 'calendar-month', 'calendar-year', 'shift-plan-kind'].includes(target.id)
  )
    return false;
  if (target.id === 'schedule-employee' && state.data.user.role === 'admin')
    state.scheduleEmployeeId = target.value;
  if (target.id === 'calendar-month')
    selectMonth(`${state.scheduleMonth.slice(0, 4)}-${target.value}`);
  if (target.id === 'calendar-year') selectMonth(`${target.value}-${state.scheduleMonth.slice(5)}`);
  if (target.id === 'shift-plan-kind' && state.data.user.role === 'admin') {
    const plan = monthPlan(state.scheduleEmployeeId, state.scheduleMonth);
    if (plan && !plan.saving) plan.kind = target.value;
  }
  const id = target.id;
  render();
  document.getElementById(id)?.focus({ preventScroll: true });
  return true;
}

export function handleCalendarKey(event) {
  const day = event.target.closest?.('.calendar-day');
  if (!day) return;
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (!Object.hasOwn(offsets, event.key)) return;
  const date = new Date(`${day.dataset.calendarDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsets[event.key]);
  const next = document.querySelector(`[data-calendar-date="${date.toISOString().slice(0, 10)}"]`);
  if (next) {
    event.preventDefault();
    next.focus({ preventScroll: true });
  }
}
