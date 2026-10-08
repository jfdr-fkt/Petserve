import { state } from './state.js';
import { field } from './components.js';
import { escapeHTML as e, timeLabel, dateLabel } from './utils.js';

export function careDialog(type, id) {
  if (type !== 'care-status') return null;
  const parts = state.data.appointments.filter((item) => item.carePlanId === id);
  const active = parts.filter((item) => ['pending', 'confirmed'].includes(item.status));
  const status = state.dialog.status;
  return {
    title:
      status === 'confirmed'
        ? 'Confirm this care request?'
        : status === 'rejected'
          ? 'Decline this care request?'
          : 'Cancel the remaining care?',
    description: `${active.length} service appointments · ${dateLabel(parts[0].date)}`,
    content: `<ul class="care-review-list">${active.map((item) => `<li><strong>${e(item.petName)}</strong><span>${e(item.serviceName)} · ${timeLabel(item.time)}</span></li>`).join('')}</ul>${state.data.user.role !== 'customer' ? field('Message for the visit (optional)', 'staffNote', '', { type: 'textarea', attrs: 'maxlength="300"' }) : ''}<p class="form-footnote">${status === 'confirmed' ? 'Every service time is checked again before the request is confirmed.' : 'Completed services and payment records are kept.'}</p>`,
    label:
      status === 'confirmed'
        ? 'Confirm all services'
        : status === 'rejected'
          ? 'Decline request'
          : 'Cancel remaining services',
  };
}
