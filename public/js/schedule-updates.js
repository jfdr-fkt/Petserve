import { api } from './api.js';
import { state } from './state.js';

let timer = null;
let generation = 0;
let checking = false;
let onFocus = null;

export function stopScheduleUpdates() {
  generation++;
  clearInterval(timer);
  timer = null;
  if (onFocus) window.removeEventListener('focus', onFocus);
  onFocus = null;
}

export function startScheduleUpdates(render) {
  stopScheduleUpdates();
  if (state.data?.user?.role !== 'staff' || state.view !== 'schedule') return;
  const current = generation;
  const check = async () => {
    if (checking || document.hidden || state.view !== 'schedule') return;
    checking = true;
    try {
      const data = await api('/api/bootstrap');
      if (current !== generation || !data.user || data.user.id !== state.data?.user?.id) return;
      if (
        JSON.stringify([data.shifts, data.schedule, data.appointments]) !==
        JSON.stringify([state.data.shifts, state.data.schedule, state.data.appointments])
      ) {
        state.data = data;
        if (!state.dialog) {
          const focusedDate = document.activeElement?.dataset.calendarDate;
          render();
          if (focusedDate)
            document
              .querySelector(`[data-calendar-date="${focusedDate}"]`)
              ?.focus({ preventScroll: true });
        }
      }
    } catch {
      // Leave the last received schedule visible during a temporary connection failure.
    } finally {
      checking = false;
    }
  };
  timer = setInterval(check, 15000);
  onFocus = check;
  window.addEventListener('focus', onFocus);
}
