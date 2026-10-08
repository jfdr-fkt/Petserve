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
  )}<div class="list-toolbar"><div class="tabs filter-tabs">${['all', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected'].map((status) => `<button type="button" data-filter="${status}" class="${state.filter === status ? 'active' : ''}">${status === 'all' ? 'All visits' : status[0].toUpperCase() + status.slice(1)}<span>${status === 'all' ? apps.length : apps.filter((a) => a.status === status).length}</span></button>`).join('')}</div><label class="search-field compact">${icon('search')}<input type="search" name="search" aria-label="Search appointments" value="${e(state.search)}" placeholder="Find a visit…"></label></div><div class="appointment-list">${list.length ? appointmentGroups(list, staff) : `<section class="panel">${empty('No visits here just yet', state.search ? 'Try another name or service.' : staff ? 'New appointment requests will appear here.' : 'Find a time for their next little care moment.', staff ? '' : viewButton('Book a visit', 'book', 'plus', 'soft'), 'calendar')}</section>`}</div>`;
}

function appointmentGroups(list, staff) {
  const emitted = new Set();
  return list
    .map((item) => {
      if (!item.carePlanId) return appointmentCard(item, staff);
      if (emitted.has(item.carePlanId)) return '';
      emitted.add(item.carePlanId);
      const full = state.data.appointments.filter((entry) => entry.carePlanId === item.carePlanId);
      const shown = list
        .filter((entry) => entry.carePlanId === item.carePlanId)
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      const count = new Set(full.flatMap((entry) => entry.petIds)).size;
      const dates = new Set(full.map((entry) => entry.date));
      const timing =
        dates.size > 1
          ? `${dates.size} visit dates · See each service below`
          : `${dateLabel(item.date)} · Arrival ${timeLabel(item.arrivalTime)}`;
      const pending = full.every((entry) => entry.status === 'pending');
      const active = full.some(
        (entry) => ['pending', 'confirmed'].includes(entry.status) && !entry.payment,
      );
      const attrs = `data-id="${item.carePlanId}"`;
      return `<section class="care-request-group"><header class="care-request-heading"><div><span class="eyebrow">CARE REQUEST #${item.carePlanId.slice(0, 8).toUpperCase()}</span><h2>${count} ${count === 1 ? 'pet' : 'pets'} · ${full.length} service appointments</h2><p>${timing}${staff ? ` · ${e(item.customerName)}` : ''}</p></div><div class="actions">${staff && pending ? button('Decline request', 'care-status-open', '', 'outline', `${attrs} data-status="rejected"`) + button('Confirm all services', 'care-status-open', 'check', 'primary', `${attrs} data-status="confirmed"`) : ''}${active ? button('Cancel remaining care', 'care-status-open', '', 'outline', `${attrs} data-status="cancelled"`) : ''}</div></header>${shown.map((entry) => appointmentCard(entry, staff)).join('')}</section>`;
    })
    .join('');
}

function appointmentCard(a, staff) {
  const pet = state.data.pets.find((p) => p.id === a.petId) || { name: a.petName, species: 'Dog' };
  const attrs = `data-id="${a.id}"`;
  const reviewed = state.data.feedback.some((f) => f.appointmentId === a.id);
  return `<article class="panel appointment-card"><div class="appointment-top"><div class="appointment-pet">${petAvatar(pet)}<div><h3>${e(a.petName)} <span>· ${e(a.serviceName)}</span></h3><p>${staff ? e(a.customerName) : `${a.petIds.length > 1 ? `${a.petIds.length} pets · ` : ''}${a.resource === 'groomer' ? 'Grooming team' : 'Veterinary team'}`}</p></div></div>${statusBadge(a.status)}</div><div class="appointment-details"><span>${icon('calendar')}${dateLabel(a.date)}</span><span>${icon('clock')}${timeLabel(a.time)}</span><span>${icon('card')}${a.payment ? `${money(a.payment.amount)} recorded` : a.status === 'completed' ? 'Payment awaiting record' : `Estimated ${money(a.basePrice)}`}</span><small>Visit #${a.id.slice(0, 8).toUpperCase()}</small></div>${a.note ? `<div class="appointment-note"><small>Owner’s visit note</small><p>${e(a.note)}</p></div>` : ''}${a.staffNote ? `<div class="appointment-note staff-note"><small>Message from the care team</small><p>${e(a.staffNote)}</p></div>` : ''}${a.serviceRecord ? `<div class="appointment-note service-record"><small>Completed service record</small><p>${e(a.serviceRecord.notes || 'Service completed by the care team.')}</p></div>` : ''}${transferStatus(a, staff)}<div class="appointment-actions"><small>${a.status === 'pending' ? 'Waiting for the care team to confirm this time.' : a.status === 'confirmed' ? 'All set. We look forward to seeing you.' : a.status === 'completed' ? 'Another little care milestone.' : 'This appointment is closed.'}</small><div class="actions">${staff && a.status === 'pending' ? button('Decline', 'status-open', '', 'outline', `${attrs} data-status="rejected"`) + button('Confirm visit', 'status-open', 'check', 'primary', `${attrs} data-status="confirmed"`) : ''}${staff && a.status === 'confirmed' ? button('Cancel visit', 'status-open', '', 'outline', `${attrs} data-status="cancelled"`) + button('Record completed care', 'status-open', 'check', 'primary', `${attrs} data-status="completed"`) : ''}${!staff && ['pending', 'confirmed'].includes(a.status) && !a.payment ? button('Cancel', 'status-open', '', 'outline', `${attrs} data-status="cancelled"`) : ''}${state.data.user.role !== 'staff' && ['pending', 'confirmed'].includes(a.status) && !a.payment ? button('Reschedule', 'reschedule', 'calendar', 'soft', attrs) : ''}${a.status === 'completed' && !a.payment ? paymentAction(a, staff) : ''}${a.payment ? button('View receipt', 'receipt', 'card', 'soft', attrs) : ''}${!staff && a.status === 'completed' ? button(reviewed ? 'Edit feedback' : 'Leave feedback', 'feedback-write', 'feedback', 'soft', attrs) : ''}${!staff && ['completed', 'cancelled', 'rejected'].includes(a.status) ? button('Book again', 'book-again', 'plus', 'outline', attrs) : ''}${button(staff ? 'Message owner' : 'Chat with Petopia', 'chat-open', 'chat', 'outline', `data-id="${a.customerId}"`)}</div></div></article>`;
}

function paymentAction(visit, staff) {
  const pending = visit.paymentRequest?.status === 'pending';
  const attrs = `data-id="${visit.id}"`;
  if (staff)
    return pending
      ? button('Review transfer', 'transfer-review', 'card', 'primary', attrs)
      : button('Record payment', 'payment', 'card', 'soft', attrs);
  if (pending) return '<span class="status pending">Awaiting verification</span>';
  const available = Object.values(state.data.wallets).some((wallet) => wallet.enabled);
  return available
    ? button('Pay with GCash / Maya', 'online-payment', 'card', 'primary', attrs)
    : button('Ask about payment', 'chat-open', 'chat', 'outline', `data-id="${visit.customerId}"`);
}
function transferStatus(visit, staff) {
  const r = visit.paymentRequest;
  if (!r || visit.payment) return '';
  return `<div class="transfer-status"><strong>${r.status === 'pending' ? 'Online transfer awaiting verification' : 'Transfer needs attention'}</strong><small>${e(r.method)} ? ${money(r.amount)} ? Reference ${e(r.reference)}</small><p>${e(r.reviewNote || (staff ? 'Check the shop?s wallet before verifying this transfer.' : 'The care team will check the payment and confirm your receipt.'))}</p></div>`;
}
export function payments() {
  const staff = isStaff(),
    apps = state.data.appointments,
    paid = apps.filter((a) => a.payment),
    outstanding = apps.filter((a) => a.status === 'completed' && !a.payment);
  const enabled = Object.entries(state.data.wallets)
    .filter(([, wallet]) => wallet.enabled)
    .map(([name]) => name);
  return `${heading('The details, all accounted for', staff ? 'Payments' : 'Payments & receipts', staff ? 'Verify online transfers, record clinic payments, and keep every receipt connected.' : 'Pay for completed visits and keep your receipts together.', staff ? button('Wallet settings', 'payment-settings', 'settings', 'outline') : '')}${stats(
    [
      ['Recorded payments', paid.length, 'card', 'sage'],
      [
        'Total recorded',
        money(paid.reduce((sum, a) => sum + a.payment.amount, 0)),
        'check',
        'lavender',
      ],
      [
        'Awaiting verification',
        apps.filter((a) => a.paymentRequest?.status === 'pending').length,
        'clock',
        'sand',
      ],
    ],
  )}${!staff ? `<div class="gallery-intro">${icon('card')}<p>${enabled.length ? `Online transfers are available through ${enabled.map(e).join(' and ')}. Submit the wallet reference after sending payment; staff will verify receipt.` : 'Online wallet details have not been set up yet. You can pay at the clinic or ask the care team in chat.'}</p></div>` : ''}${outstanding.length ? `<section class="panel payment-outstanding"><div class="panel-header"><div><h2>Completed visits to settle</h2><p>${staff ? 'Review transfers or record the payment received at the clinic.' : 'Choose a visit to submit a wallet transfer.'}</p></div></div>${outstanding.map((a) => `<div class="payment-row"><div><strong>${e(a.petName)} ? ${e(a.serviceName)}</strong><small>${dateLabel(a.date)} ? service price ${money(a.basePrice)}</small>${a.paymentRequest ? `<small>${e(a.paymentRequest.method)} reference ${e(a.paymentRequest.reference)} ? ${a.paymentRequest.status === 'pending' ? 'Awaiting verification' : e(a.paymentRequest.reviewNote)}</small>` : ''}</div>${paymentAction(a, staff)}</div>`).join('')}</section>` : ''}<section class="panel"><div class="panel-header"><div><h2>Payment history</h2><p>Receipts are available after a clinic payment is recorded or an online transfer is verified.</p></div></div>${
    paid.length
      ? `<div class="table-wrap"><table><thead><tr><th>Visit</th><th>Recorded</th><th>Method</th><th>Amount</th><th>Receipt</th></tr></thead><tbody>${paid
          .sort((a, b) => b.payment.recordedAt.localeCompare(a.payment.recordedAt))
          .map(
            (a) =>
              `<tr><td><strong>${e(a.petName)}</strong><small>${e(a.serviceName)}</small></td><td>${new Date(a.payment.recordedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</td><td>${e(a.payment.method)}</td><td><strong>${money(a.payment.amount)}</strong></td><td>${button('View receipt', 'receipt', 'card', 'soft', `data-id="${a.id}"`)}</td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : empty('A clear start', 'Verified payments and their receipts will appear here.', '', 'card')
  }</section>`;
}
