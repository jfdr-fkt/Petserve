import { state, isStaff } from '../state.js';
import {
  heading,
  stats,
  icon,
  button,
  viewButton,
  statusBadge,
  petAvatar,
  empty,
} from '../components.js';
import { escapeHTML as e, money, dateLabel, timeLabel } from '../utils.js';

export function appointments() {
  const staff = isStaff(),
    apps = state.data.appointments;
  const list = apps.filter(
    (a) =>
      (state.filter === 'all' || a.status === state.filter) &&
      `${a.petName} ${a.customerName} ${a.serviceName}`
        .toLowerCase()
        .includes(state.search.toLowerCase()),
  );
  return `${heading(staff ? 'A smoother day starts here' : 'Every visit, kept together', staff ? 'Appointments' : 'My appointments', staff ? 'Review requests, connect with pet owners, and record their care.' : 'Follow their visit from the first request to the final happy wag.', staff ? viewButton('Open schedule', 'schedule', 'calendar', 'outline') : viewButton('Book a visit', 'book', 'plus'))}${stats(
    [
      ['Awaiting review', apps.filter((a) => a.status === 'pending').length, 'clock', 'sand'],
      ['Confirmed', apps.filter((a) => a.status === 'confirmed').length, 'calendar', 'sage'],
      ['Completed', apps.filter((a) => a.status === 'completed').length, 'check', 'lavender'],
      ['All visits', apps.length, 'queue', 'peach'],
    ],
  )}<div class="list-toolbar"><div class="tabs filter-tabs">${['all', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected'].map((status) => `<button type="button" data-filter="${status}" class="${state.filter === status ? 'active' : ''}">${status === 'all' ? 'All visits' : status[0].toUpperCase() + status.slice(1)}<span>${status === 'all' ? apps.length : apps.filter((a) => a.status === status).length}</span></button>`).join('')}</div><label class="search-field compact">${icon('search')}<input type="search" name="search" aria-label="Search appointments" value="${e(state.search)}" placeholder="Find a visit…"></label></div><div class="appointment-list">${list.length ? list.map((a) => appointmentCard(a, staff)).join('') : `<section class="panel">${empty('No visits here just yet', state.search ? 'Try another name or service.' : staff ? 'New appointment requests will appear here.' : 'Find a time for their next little care moment.', staff ? '' : viewButton('Book a visit', 'book', 'plus', 'soft'), 'calendar')}</section>`}</div>`;
}

function appointmentCard(a, staff) {
  const pet = state.data.pets.find((p) => p.id === a.petId) || { name: a.petName, species: 'Dog' };
  const attrs = `data-id="${a.id}"`;
  const reviewed = state.data.feedback.some((f) => f.appointmentId === a.id);
  return `<article class="panel appointment-card"><div class="appointment-top"><div class="appointment-pet">${petAvatar(pet)}<div><h3>${e(a.petName)} <span>· ${e(a.serviceName)}</span></h3><p>${staff ? e(a.customerName) : `${a.duration} minutes · ${a.resource === 'groomer' ? 'Grooming team' : 'Veterinary team'}`}</p></div></div>${statusBadge(a.status)}</div><div class="appointment-details"><span>${icon('calendar')}${dateLabel(a.date)}</span><span>${icon('clock')}${timeLabel(a.time)}</span><span>${icon('card')}${a.payment ? `${money(a.payment.amount)} recorded` : a.status === 'completed' ? 'Payment awaiting record' : `Estimated ${money(a.basePrice)}`}</span><small>Visit #${a.id.slice(0, 8).toUpperCase()}</small></div>${a.note ? `<div class="appointment-note"><small>Owner’s visit note</small><p>${e(a.note)}</p></div>` : ''}${a.staffNote ? `<div class="appointment-note staff-note"><small>Message from the care team</small><p>${e(a.staffNote)}</p></div>` : ''}${a.serviceRecord ? `<div class="appointment-note service-record"><small>Completed service record</small><p>${e(a.serviceRecord.notes || 'Service completed by the care team.')}</p></div>` : ''}<div class="appointment-actions"><small>${a.status === 'pending' ? 'Waiting for the care team to confirm this time.' : a.status === 'confirmed' ? 'All set. We look forward to seeing you.' : a.status === 'completed' ? 'Another little care milestone.' : 'This appointment is closed.'}</small><div class="actions">${staff && a.status === 'pending' ? button('Decline', 'status-open', '', 'outline', `${attrs} data-status="rejected"`) + button('Confirm visit', 'status-open', 'check', 'primary', `${attrs} data-status="confirmed"`) : ''}${staff && a.status === 'confirmed' ? button('Cancel visit', 'status-open', '', 'outline', `${attrs} data-status="cancelled"`) + button('Record completed care', 'status-open', 'check', 'primary', `${attrs} data-status="completed"`) : ''}${!staff && ['pending', 'confirmed'].includes(a.status) && !a.payment ? button('Cancel', 'status-open', '', 'outline', `${attrs} data-status="cancelled"`) : ''}${['pending', 'confirmed'].includes(a.status) && !a.payment ? button('Reschedule', 'reschedule', 'calendar', 'soft', attrs) : ''}${staff && a.status === 'completed' && !a.payment ? button('Record payment', 'payment', 'card', 'primary', attrs) : ''}${a.payment ? button('View receipt', 'receipt', 'card', 'soft', attrs) : ''}${!staff && a.status === 'completed' ? button(reviewed ? 'Edit feedback' : 'Leave feedback', 'feedback-write', 'feedback', 'soft', attrs) : ''}${!staff && ['completed', 'cancelled', 'rejected'].includes(a.status) ? button('Book again', 'book-again', 'plus', 'outline', attrs) : ''}</div></div></article>`;
}

export function payments() {
  const staff = isStaff(),
    apps = state.data.appointments,
    paid = apps.filter((a) => a.payment);
  const outstanding = apps.filter((a) => a.status === 'completed' && !a.payment);
  return `${heading('The details, all accounted for', staff ? 'Payments' : 'Payments & receipts', staff ? 'Record payments at the clinic and keep every receipt connected.' : 'A clear record of each payment made at the clinic.')}${stats(
    [
      ['Recorded payments', paid.length, 'card', 'sage'],
      [
        'Total recorded',
        money(paid.reduce((sum, a) => sum + a.payment.amount, 0)),
        'check',
        'lavender',
      ],
      ['Awaiting record', outstanding.length, 'clock', 'sand'],
    ],
  )}${outstanding.length ? `<section class="panel payment-outstanding"><div class="panel-header"><div><h2>Awaiting payment record</h2><p>${staff ? 'These completed visits need a payment record.' : 'The clinic will record payment for these completed visits.'}</p></div></div>${outstanding.map((a) => `<div class="payment-row"><div><strong>${e(a.petName)} · ${e(a.serviceName)}</strong><small>${dateLabel(a.date)} · estimated ${money(a.basePrice)}</small></div>${staff ? button('Record payment', 'payment', 'plus', 'soft', `data-id="${a.id}"`) : '<span class="status pending">Awaiting record</span>'}</div>`).join('')}</section>` : ''}<section class="panel"><div class="panel-header"><div><h2>Payment history</h2><p>Receipts are available as soon as a payment is recorded.</p></div></div>${
    paid.length
      ? `<div class="table-wrap"><table><thead><tr><th>Visit</th><th>Recorded</th><th>Method</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>${paid
          .sort((a, b) => b.payment.recordedAt.localeCompare(a.payment.recordedAt))
          .map(
            (a) =>
              `<tr><td><strong>${e(a.petName)}</strong><small>${e(a.serviceName)}</small></td><td>${new Date(a.payment.recordedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</td><td>${e(a.payment.method)}</td><td><strong>${money(a.payment.amount)}</strong></td><td>${button('View receipt', 'receipt', 'card', 'soft', `data-id="${a.id}"`)}</td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : empty('A clear start', 'Payments recorded at the clinic will appear here.', '', 'card')
  }</section>`;
}
