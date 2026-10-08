import { state, isStaff } from './state.js';
import { field, icon, petAvatar, receipt } from './components.js';
import { escapeHTML as e, money, dateLabel, timeLabel, todayManila } from './utils.js';
import { slotPicker } from './views/booking.js';
import { communityDialog } from './community-dialogs.js';
import { paymentDialog } from './payment-dialogs.js';
import { shiftDialog } from './shift-schedule.js';
import { accountDialog } from './account-dialogs.js';
import { careDialog } from './care-dialogs.js';

export function dialogContent() {
  if (!state.dialog) return '';
  const { type, id, status } = state.dialog,
    d = state.draft;
  const a = state.data.appointments.find((a) => a.id === id);
  let title = '',
    description = '',
    content = '',
    label = 'Save changes',
    form = type,
    wide = false;
  const community =
    communityDialog(type, id, d) ||
    paymentDialog(type, id, d) ||
    shiftDialog(type, id, d) ||
    accountDialog(type, id) ||
    careDialog(type, id);
  if (community) {
    ({ title, description, content, label } = community);
  } else if (type === 'pet') {
    title = id ? 'A little profile refresh.' : 'Meet your new companion.';
    description = 'Their personality, their care, and all the little details.';
    wide = true;
    content = `<div class="photo-editor">${petAvatar({ ...d, name: d.name || 'Pet' }, 'lg')}<div><strong>A face you know and love</strong><p>JPG, PNG or WebP. Choose a photo up to 10 MB.</p><label class="btn btn-soft photo-upload">${icon('plus')}Choose photo<input type="file" id="pet-photo" accept="image/png,image/jpeg,image/webp" class="sr-only"></label>${d.photoUrl ? '<button type="button" class="text-button" data-action="photo-remove">Remove photo</button>' : ''}</div></div><div class="form-grid">${field('Pet name', 'name', d.name, { required: true, attrs: 'maxlength="80"', placeholder: 'What do you call them?' })}${field('Species', 'species', d.species || 'Dog', { choices: ['Dog', 'Cat', 'Other'], required: true })}${field('Breed (optional)', 'breed', d.breed, { attrs: 'maxlength="80"', placeholder: 'Aspin, Puspin, or one of a kind' })}${field('Sex (optional)', 'sex', d.sex, { choices: [['', 'Not specified'], 'Male', 'Female'] })}${field('Birthday (optional)', 'birthDate', d.birthDate, { type: 'date', attrs: `max="${todayManila()}"` })}${field('Age (optional)', 'age', d.age, { attrs: 'maxlength="40"', placeholder: 'e.g. 2 years' })}${field('Weight in kg (optional)', 'weight', d.weight, { type: 'number', attrs: 'min="0.01" max="300" step="0.01"', placeholder: 'e.g. 12' })}${field('Allergies or sensitivities', 'allergies', d.allergies, { attrs: 'maxlength="200"', placeholder: 'Anything the team should know' })}</div>${field('A little about them (optional)', 'notes', d.notes, { type: 'textarea', attrs: 'maxlength="300"', placeholder: 'Their personality, behavior, and comfort notes.' })}`;
    label = id ? 'Save profile' : 'Add to the family';
  } else if (type === 'health') {
    title = 'Keep a care milestone.';
    description = 'Record a past visit or an owner-provided health note.';
    content = `${field('Record title', 'title', d.title, { required: true, attrs: 'maxlength="100"', placeholder: 'e.g. Annual rabies vaccination' })}<div class="form-grid">${field(
      'Record type',
      'type',
      d.type || 'vaccine',
      {
        choices: [
          ['vaccine', 'Vaccination'],
          ['deworming', 'Deworming'],
          ['medical', 'Health note'],
        ],
      },
    )}${field('Record date', 'date', d.date || todayManila(), { type: 'date', required: true, attrs: `max="${todayManila()}"` })}</div>${field('Follow-up date (optional)', 'dueDate', d.dueDate, { type: 'date', hint: 'Use a date provided by the clinic. It will appear in care reminders.' })}${field('Notes (optional)', 'notes', d.notes, { type: 'textarea', attrs: 'maxlength="300"', placeholder: 'What would you like to keep on record?' })}<p class="form-footnote">Saved as ${isStaff() ? 'a clinic record' : 'owner-provided information'}.</p>`;
    label = 'Save care record';
  } else if (type === 'status') {
    title = {
      confirmed: 'A visit to look forward to.',
      rejected: 'Decline this request?',
      completed: 'Another little care milestone.',
      cancelled: 'Cancel this visit?',
    }[status];
    description = `${a.petName} · ${a.serviceName} · ${dateLabel(a.date)} · ${timeLabel(a.time)}`;
    content =
      status === 'completed'
        ? field('Completed service notes', 'serviceNotes', d.serviceNotes, {
            type: 'textarea',
            required: true,
            attrs: 'maxlength="1000"',
            placeholder: 'Record the care provided and any follow-up instructions.',
          })
        : isStaff()
          ? field('Message to the pet owner', 'staffNote', d.staffNote, {
              type: 'textarea',
              required: status === 'rejected',
              attrs: 'maxlength="300"',
              placeholder:
                status === 'rejected'
                  ? 'Explain why this request could not be accepted.'
                  : 'Anything they should know before their visit?',
            })
          : '<div class="subtle-note">This time will be released. You can book another visit when you’re ready.</div>';
    label = {
      confirmed: 'Confirm visit',
      rejected: 'Decline request',
      completed: 'Save completed service',
      cancelled: 'Cancel visit',
    }[status];
  } else if (type === 'payment') {
    title = 'Keep their payment connected.';
    description = `${a.petName} · ${a.serviceName}`;
    content = `<div class="payment-estimate"><span>Estimated service price</span><strong>${money(a.basePrice)}</strong></div>${field('Amount received (₱)', 'amount', d.amount ?? a.basePrice / 100, { type: 'number', required: true, attrs: 'min="0.01" max="1000000" step="0.01"' })}${field('Payment method', 'method', d.method || 'Cash', { choices: ['Cash', 'GCash', 'Maya', 'E-wallet', 'Credit Card', 'Other'] })}${field('Reference (optional)', 'reference', d.reference, { attrs: 'maxlength="60"', placeholder: 'Transaction or manual receipt reference' })}<p class="form-footnote">Record a payment already received at the clinic. A receipt will be available to the owner.</p>`;
    label = 'Record payment';
  } else if (type === 'receipt') {
    return `<div class="modal-backdrop"><section class="modal-card receipt-modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-header no-print"><h2 id="dialog-title">Your payment receipt</h2><button type="button" class="icon-button" data-action="dialog-close" aria-label="Close dialog">${icon('close')}</button></div>${receipt(a)}<div class="modal-footer no-print"><button type="button" class="btn btn-outline" data-action="dialog-close">Close</button><button type="button" class="btn btn-primary" data-action="print">${icon('print')}Print / save PDF</button></div></section></div>`;
  } else if (type === 'reschedule') {
    title = 'Make a little room for change.';
    description = `${a.petName} · ${a.serviceName}. The care team will review the new time.`;
    content = `${field('New visit date', 'date', state.booking.date, { type: 'date', id: 'reschedule-date', required: true, attrs: `min="${todayManila()}" max="${new Date(Date.parse(`${todayManila()}T12:00Z`) + 90 * 86400000).toISOString().slice(0, 10)}"` })}<div class="field"><label>Available times</label><div id="slot-picker">${slotPicker()}</div></div>`;
    label = 'Request a new time';
  } else if (type === 'availability') {
    title = 'A calendar that works for your team.';
    description = 'Choose regular opening days and appointment start times.';
    wide = true;
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    content = `<div class="field"><label>Open days</label><div class="checkbox-grid">${weekdays.map((day, index) => `<label class="check-option"><input type="checkbox" name="weekday" value="${index}" ${state.data.schedule.weekdays.includes(index) ? 'checked' : ''}>${day}</label>`).join('')}</div></div><div class="field"><label>Appointment start times</label><div class="checkbox-grid time-checkboxes">${Array.from(
      { length: 16 },
      (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
    )
      .map(
        (time) =>
          `<label class="check-option"><input type="checkbox" name="slot" value="${time}" ${state.data.timeSlots.includes(time) ? 'checked' : ''}>${timeLabel(time)}</label>`,
      )
      .join(
        '',
      )}</div></div><div class="subtle-note">The clinic closes at 5 PM. Confirmed visits must be rescheduled before removing their day or time.</div>`;
    label = 'Save availability';
  } else if (type === 'block') {
    title = 'A little time away.';
    description = 'Keep new bookings out of a time your team is unavailable.';
    content = `${field('Date', 'date', d.date || state.scheduleDate || todayManila(), { type: 'date', required: true, attrs: `min="${todayManila()}"` })}${field(
      'Care team',
      'resource',
      d.resource || 'groomer',
      {
        choices: [
          ['groomer', 'Grooming team'],
          ['veterinarian', 'Veterinary team'],
        ],
      },
    )}${field('Time', 'time', d.time, { choices: [['', 'All day'], ...state.data.timeSlots.map((time) => [time, timeLabel(time)])] })}${field('Reason (optional)', 'reason', d.reason, { attrs: 'maxlength="120"', placeholder: 'e.g. Team leave or clinic event' })}`;
    label = 'Block time';
  } else if (type === 'service') {
    title = 'A little care-menu refresh.';
    description = 'Updates apply to new requests. Existing visits keep their booked price.';
    content = `${field('Service name', 'name', d.name, { required: true, attrs: 'maxlength="80"' })}${field('Description', 'description', d.description, { type: 'textarea', attrs: 'maxlength="300"' })}<div class="form-grid">${field('Estimated price (₱)', 'price', d.basePrice / 100, { type: 'number', required: true, attrs: 'min="0" max="1000000" step="0.01"' })}</div>${field(
      'Booking availability',
      'active',
      String(d.active),
      {
        choices: [
          ['true', 'Available for booking'],
          ['false', 'Pause new bookings'],
        ],
      },
    )}`;
  } else if (type === 'user') {
    title = 'The right access.';
    description = `${d.name} · ${d.email}`;
    content = `${field('Account role', 'role', d.role, {
      choices: [
        ['customer', 'Customer'],
        ['staff', 'Employee'],
        ['admin', 'Administrator'],
      ],
    })}${field('Account status', 'disabled', String(Boolean(d.disabled)), {
      choices: [
        ['false', 'Active'],
        ['true', 'Inactive'],
      ],
    })}<div class="subtle-note">Changing access signs this person out. Your own administrator account must remain active.</div>`;
    label = 'Update account access';
  } else if (type === 'archive') {
    title = `Archive ${e(d.name)}’s profile?`;
    description = 'Past appointments, completed services, and receipts will remain available.';
    content =
      '<div class="subtle-note">Cancel or complete any upcoming visits first. This profile will no longer appear in My Pets.</div>';
    label = 'Archive profile';
  }
  return `<div class="modal-backdrop"><section class="modal-card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-header"><div><span class="eyebrow">A LITTLE ATTENTION TO DETAIL</span><h2 id="dialog-title">${title}</h2><p>${e(description)}</p></div><button type="button" class="icon-button" data-action="dialog-close" aria-label="Close dialog">${icon('close')}</button></div><form data-form="${form}" data-id="${id || ''}"><div class="modal-body">${content}<div class="form-error" role="alert" hidden></div></div><div class="modal-footer"><button type="button" class="btn btn-outline" data-action="dialog-close">${type === 'status' && status === 'cancelled' ? 'Keep visit' : 'Cancel'}</button><button type="submit" class="btn ${['archive', 'account-delete', 'chat-delete', 'chat-clear'].includes(type) || (type === 'status' && ['cancelled', 'rejected'].includes(status)) ? 'btn-danger' : 'btn-primary'}" ${type === 'reschedule' && !state.booking.time ? 'disabled' : ''}>${label}</button></div></form></section></div>`;
}
