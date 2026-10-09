import { state } from './state.js';
import { button, field, icon } from './components.js';
import { escapeHTML as e, todayManila } from './utils.js';
import { monthDates, monthLabel, weekday } from './calendar-dates.js';
import { api, toast } from './api.js';

export function monthPlan(employeeId, month) {
  if (!employeeId) return null;
  const key = `${employeeId}/${month}`;
  return (state.shiftPlans[key] ||= {
    employeeId,
    month,
    selected: [],
    changes: {},
    kind: 'work',
    start: '09:00',
    end: '17:00',
    notes: '',
    error: '',
    saving: false,
  });
}

export function currentPlan() {
  return monthPlan(state.scheduleEmployeeId, state.scheduleMonth);
}

export function planAssignments(date, employeeId, plan = null) {
  if (plan && Object.hasOwn(plan.changes, date))
    return plan.changes[date].kind === 'clear' ? [] : [plan.changes[date]];
  return state.data.shifts.filter(
    (shift) => shift.employeeId === employeeId && shift.date === date,
  );
}

export function shiftPlanner(plan) {
  if (!plan)
    return '<section class="panel shift-planner"><h2>No active employees</h2><p>Add an employee account to plan working hours.</p></section>';
  const pending = Object.keys(plan.changes).length;
  const editable = monthDates(plan.month).some((date) => date >= todayManila());
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const otherDrafts = Object.entries(state.shiftPlans).filter(
    ([key, draft]) =>
      key !== `${plan.employeeId}/${plan.month}` && Object.keys(draft.changes).length,
  );
  return `<aside class="panel shift-planner" aria-label="Monthly shift editor"><form data-form="shift-plan"><div class="shift-planner-heading"><span class="icon-tile sage">${icon('calendar')}</span><div><h2>Plan this month</h2><p>${plan.selected.length} ${plan.selected.length === 1 ? 'date' : 'dates'} selected</p></div></div>
    <fieldset class="shift-plan-controls" ${plan.saving || !editable ? 'disabled' : ''}><legend class="sr-only">Shift assignment</legend>
    <div class="plan-selection-actions">${button('All days', 'plan-select', '', 'outline', 'data-selection="all"')}${button('Weekdays', 'plan-select', '', 'outline', 'data-selection="weekdays"')}${button('Clear selection', 'plan-select', '', 'outline', 'data-selection="none"')}</div>
    <div class="plan-weekdays" aria-label="Select a weekday throughout the month">${weekdays
      .map((name, index) => {
        const dates = monthDates(plan.month).filter(
          (date) => date >= todayManila() && weekday(date) === index,
        );
        return `<button type="button" data-action="plan-weekday" data-weekday="${index}" aria-label="Select all ${name}s" aria-pressed="${dates.length > 0 && dates.every((date) => plan.selected.includes(date))}" ${dates.length ? '' : 'disabled'}>${name.slice(0, 2)}</button>`;
      })
      .join('')}</div>
    <p class="plan-selected-dates">${
      plan.selected.length
        ? plan.selected
            .map((date) => Number(date.slice(-2)))
            .sort((a, b) => a - b)
            .join(', ')
        : 'Select dates on the calendar.'
    }</p>
    ${field('Assignment', 'kind', plan.kind, {
      id: 'shift-plan-kind',
      choices: [
        ['work', 'Working shift'],
        ['rest', 'Rest day'],
        ['leave', 'Leave'],
      ],
    })}
    <div class="form-grid" ${plan.kind === 'work' ? '' : 'hidden'}>${field('Starts at', 'start', plan.start, { id: 'shift-plan-start', type: 'time', required: plan.kind === 'work' })}${field('Ends at', 'end', plan.end, { id: 'shift-plan-end', type: 'time', required: plan.kind === 'work' })}</div>
    ${field('Reason / note', 'notes', plan.notes, { id: 'shift-plan-notes', type: 'textarea', attrs: 'maxlength="200" rows="3"', hint: 'Visible to the employee.' })}
    <div class="plan-apply-actions"><button type="submit" class="btn btn-soft" ${plan.selected.length ? '' : 'disabled'}>${icon('check')}Apply to selected dates</button>${button('Clear assignment', 'plan-clear', '', 'outline', plan.selected.length ? '' : 'disabled')}</div>
    </fieldset><div class="form-error" role="alert" ${plan.error ? '' : 'hidden'}>${e(plan.error)}</div>
    <div class="plan-save-area"><span role="status">${plan.selected.length ? 'Apply your selected dates before saving.' : pending ? `${pending} ${pending === 1 ? 'date' : 'dates'} ready to save` : 'All changes saved'}</span><div class="actions">${button(plan.saving ? 'Saving…' : 'Save month', 'plan-save', 'check', 'primary', pending && !plan.selected.length && !plan.saving ? '' : 'disabled')}${button('Discard changes', 'plan-discard', '', 'outline', pending && !plan.saving ? '' : 'disabled')}</div></div></form>
    ${!editable ? '<p class="plan-history-note">Past dates are available for viewing.</p>' : ''}
    ${otherDrafts.length ? `<div class="shift-other-drafts"><strong>Other drafts</strong>${otherDrafts.map(([key, draft]) => `<button type="button" class="text-button" data-action="plan-open" data-id="${e(key)}">${e(state.data.users.find((user) => user.id === draft.employeeId)?.name || 'Employee')} · ${monthLabel(draft.month)}</button>`).join('')}</div>` : ''}</aside>`;
}

export function handlePlanInput(target) {
  if (!target.closest('[data-form="shift-plan"]') || state.data.user.role !== 'admin') return false;
  const plan = currentPlan();
  if (plan && !plan.saving && ['start', 'end', 'notes'].includes(target.name))
    plan[target.name] = target.value;
  return true;
}

export function handlePlanSubmit(form, render) {
  const plan = currentPlan();
  if (!plan || plan.saving || state.data.user.role !== 'admin') return;
  const values = Object.fromEntries(new FormData(form).entries());
  Object.assign(plan, {
    kind: values.kind,
    start: values.start,
    end: values.end,
    notes: values.notes,
  });
  if (!plan.selected.length) plan.error = 'Select at least one date.';
  else if (plan.kind === 'work' && (!plan.start || !plan.end || plan.start >= plan.end))
    plan.error = 'The end time must be after the start time.';
  else {
    plan.error = '';
    for (const date of plan.selected)
      plan.changes[date] = {
        date,
        kind: plan.kind,
        start: plan.kind === 'work' ? plan.start : '',
        end: plan.kind === 'work' ? plan.end : '',
        notes: plan.notes.trim(),
      };
    plan.selected = [];
  }
  render();
}

export async function handlePlanClick(button, render, refresh) {
  const action = button.dataset.action;
  if (!action?.startsWith('plan-')) return false;
  if (state.data.user.role !== 'admin')
    throw new Error('Only administrators can change the schedule.');
  const plan = currentPlan();
  if (!plan || plan.saving) return true;
  const dates = monthDates(plan.month).filter((date) => date >= todayManila());
  plan.error = '';
  if (action === 'plan-select') {
    const selection = button.dataset.selection;
    plan.selected =
      selection === 'all'
        ? dates
        : selection === 'weekdays'
          ? dates.filter((date) => weekday(date) > 0 && weekday(date) < 6)
          : [];
  } else if (action === 'plan-weekday') {
    const selected = dates.filter((date) => weekday(date) === Number(button.dataset.weekday));
    plan.selected = selected.every((date) => plan.selected.includes(date))
      ? plan.selected.filter((date) => !selected.includes(date))
      : [...new Set([...plan.selected, ...selected])];
  } else if (action === 'plan-clear') {
    for (const date of plan.selected) plan.changes[date] = { date, kind: 'clear' };
    plan.selected = [];
  } else if (action === 'plan-discard') {
    plan.changes = {};
    plan.selected = [];
  } else if (action === 'plan-open') {
    const draft = state.shiftPlans[button.dataset.id];
    if (draft) {
      state.scheduleEmployeeId = draft.employeeId;
      state.scheduleMonth = draft.month;
    }
  } else if (action === 'plan-save') {
    if (!Object.keys(plan.changes).length) return true;
    plan.saving = true;
    render();
    try {
      const result = await api('/api/schedule/shifts/month', 'POST', {
        employeeId: plan.employeeId,
        month: plan.month,
        changes: Object.values(plan.changes),
      });
      plan.changes = {};
      plan.selected = [];
      plan.saving = false;
      await refresh();
      toast(`${result.updated} ${result.updated === 1 ? 'date' : 'dates'} saved.`);
    } catch (error) {
      plan.saving = false;
      plan.error = error.message;
      render();
    }
    return true;
  }
  render();
  return true;
}
