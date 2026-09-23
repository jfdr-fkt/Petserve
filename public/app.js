/* PetServe UI: intentionally framework-free so this demo opens cleanly in VS Code. */
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
const state = { data: null, view: 'overview', authMode: 'login', selectedService: 'grooming', filter: 'all', paymentFor: null, report: null };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const titleCase = value => value ? value[0].toUpperCase() + value.slice(1) : '';
const money = cents => '₱' + (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = date => new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = time => { const [hour, minute] = time.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`; };
function todayManila() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function toast(message, error = false) {
  toastElement.textContent = message;
  toastElement.classList.toggle('error', error);
  toastElement.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastElement.classList.remove('show'), 3700);
}
async function api(route, method = 'GET', data) {
  const response = await fetch(route, { method, headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), credentials: 'same-origin' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}
async function refresh() { state.data = await api('/api/bootstrap'); render(); }
function brand() { return `<span class="brand-mark" aria-hidden="true">✤</span><span>PetServe<span class="brand-dot">.</span></span>`; }
function renderAuth() {
  const registering = state.authMode === 'register';
  root.innerHTML = `<div class="auth-shell">
    <section class="auth-story">
      <a class="brand" href="/">${brand()}</a>
      <div class="story-main"><span class="eyebrow">For Petopia Pet Care Services · Demo</span><h1>Good care starts<br>with a plan.</h1><p>One simple place for pet profiles, visit requests, appointment updates, and a clear payment record.</p>
        <div class="story-features"><span>01 &nbsp;Pet profiles</span><span>02 &nbsp;Appointments</span><span>03 &nbsp;Payment records</span></div></div>
      <div class="story-footer">Prototype for class presentation. Bookings and payment records here are sample data, not live clinic transactions.</div>
    </section>
    <section class="auth-side"><div class="auth-card"><span class="eyebrow">Welcome to PetServe</span><h2>${registering ? 'Create your account' : 'Sign in to your space'}</h2><p>${registering ? 'Start with a customer account, then add your first pet.' : 'Keep your pet’s visits organized from request to receipt.'}</p>
      <div class="auth-tabs" role="tablist" aria-label="Account options"><button type="button" data-auth-mode="login" class="${registering ? '' : 'active'}" role="tab" aria-selected="${!registering}">Sign in</button><button type="button" data-auth-mode="register" class="${registering ? 'active' : ''}" role="tab" aria-selected="${registering}">Create account</button></div>
      <form data-form="auth">${registering ? `<div class="field"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" maxlength="80" placeholder="Your full name" required></div>` : ''}
        <div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div>
        <div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? 8 : 1}" placeholder="${registering ? 'At least 8 characters' : 'Enter your password'}" required></div>
        <button class="btn btn-primary btn-block" type="submit">${registering ? 'Create customer account' : 'Sign in'} <span aria-hidden="true">→</span></button></form>
      <div class="demo-box"><strong>Presentation demo accounts</strong><br>Customer: <code>alex@example.test</code><br>Staff: <code>staff@petserve.test</code><br>Password for both: <code>Petserve123!</code><br><button type="button" class="btn btn-soft btn-small" data-fill="customer">Fill customer</button> <button type="button" class="btn btn-soft btn-small" data-fill="staff">Fill staff</button></div>
    </div></section></div>`;
}
function navItems() {
  return state.data.user.role === 'staff'
    ? [['overview', '◫', 'Overview'], ['queue', '▤', 'Appointment queue'], ['reports', '▥', 'Reports']]
    : [['overview', '◫', 'Overview'], ['book', '＋', 'Book a visit'], ['appointments', '▤', 'My appointments'], ['pets', '♡', 'My pets']];
}
function renderShell(content) {
  const u = state.data.user;
  root.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" href="/" data-view="overview">${brand()}</a>
    <div><div class="workspace-label">Workspace</div><nav class="side-nav" aria-label="Main navigation">${navItems().map(([key, icon, name]) => `<button type="button" data-view="${key}" class="${state.view === key ? 'active' : ''}" ${state.view === key ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span>${name}</button>`).join('')}</nav></div>
    <div class="sidebar-bottom"><div class="sidebar-note"><strong>Local prototype · 30% scope</strong>Appointments, pet profiles, and manually recorded payments. Schedule and pricing need shop confirmation.</div>
      <div class="profile-mini"><span class="avatar" aria-hidden="true">${escapeHTML(u.name[0].toUpperCase())}</span><div><strong>${escapeHTML(u.name)}</strong><small>${u.role === 'staff' ? 'Staff workspace' : 'Pet owner'}</small></div><button type="button" data-action="logout" aria-label="Sign out" title="Sign out">⇥</button></div></div>
  </aside><div class="main"><header class="topbar"><div>PetServe <span aria-hidden="true">/</span> <strong>${escapeHTML(navItems().find(i => i[0] === state.view)?.[2] || 'Overview')}</strong></div><span class="date-chip">${dateLabel(todayManila())} · PH time</span></header><main class="content">${content}</main></div></div>`;
}
function heading(kicker, headingText, subtitle, right = '') {
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${headingText}</h1><p>${subtitle}</p></div>${right}</div>`;
}
function statusBadge(value) { return `<span class="status ${escapeHTML(value)}">● ${titleCase(value)}</span>`; }
function empty(title, detail, action = '') { return `<div class="empty"><strong>${title}</strong>${detail}${action ? `<div class="empty-action">${action}</div>` : ''}</div>`; }
function overview() {
  const staff = state.data.user.role === 'staff', items = state.data.appointments;
  const pending = items.filter(a => a.status === 'pending').length;
  const confirmed = items.filter(a => a.status === 'confirmed').length;
  const paid = items.reduce((sum, a) => sum + (a.payment?.amount || 0), 0);
  const recent = [...items].slice(0, 4);
  return `${heading('Home / at a glance', `Hello, ${escapeHTML(state.data.user.name.split(' ')[0])}.`, staff ? 'Here is your appointment desk for today.' : 'A little planning makes every visit easier.')}
    <section class="hero"><div><span class="eyebrow">${staff ? 'Clinic workspace' : 'Care made simpler'}</span><h2>${staff ? 'Keep every visit on track.' : 'A happier visit begins here.'}</h2><p>${staff ? 'Review booking requests, confirm availability, and record payments after completed services.' : 'Create a pet profile, request a visit, and follow its status from one place.'}</p><button type="button" class="btn" data-view="${staff ? 'queue' : 'book'}">${staff ? 'Open appointment queue' : 'Book an appointment'} <span aria-hidden="true">→</span></button></div><span class="hero-art" aria-hidden="true">✿</span></section>
    <div class="stats"><div class="stat"><span>Awaiting confirmation</span><strong>${pending}</strong><small>Pending requests</small></div><div class="stat"><span>Confirmed visits</span><strong>${confirmed}</strong><small>Ready to welcome</small></div><div class="stat"><span>${staff ? 'Recorded collection' : 'My pets'}</span><strong>${staff ? money(paid) : state.data.pets.length}</strong><small>${staff ? 'Manual payment records' : 'Pet profiles saved'}</small></div></div>
    <div class="two-col"><section class="panel"><div class="panel-header"><div><h2>Recent appointments</h2><p>Latest requests and status updates</p></div><button type="button" class="link" data-view="${staff ? 'queue' : 'appointments'}">View all →</button></div>
    ${recent.length ? `<div class="list">${recent.map(a => `<div class="list-row"><div class="row-start"><span class="row-icon" aria-hidden="true">${serviceIcon(a.serviceId)}</span><div class="row-main"><strong>${escapeHTML(a.serviceName)} · ${escapeHTML(a.petName)}</strong><small>${dateLabel(a.date)} · ${timeLabel(a.time)}${staff ? ` · ${escapeHTML(a.customerName)}` : ''}</small></div></div>${statusBadge(a.status)}</div>`).join('')}</div>` : empty('No appointments yet', staff ? 'Customer requests will appear here.' : 'Your upcoming visits will show up after you book one.')}</section>
    <div><section class="panel"><div class="panel-header"><h2>How it works</h2></div><div class="info-card"><strong>1 · Request a visit</strong>Choose a pet, service, and sample available time. Staff reviews every request.</div><div class="quick-card"><strong>2 · Track your appointment</strong><p>Staff confirms the visit and records a payment only after the service is completed.</p></div></section></div></div>`;
}
function serviceIcon(id) { return ({ grooming: '✂', vaccination: '✚', deworming: '◈' })[id] || '✦'; }
function booking() {
  const options = state.data.services;
  return `${heading('New appointment', 'Let’s plan a visit.', 'Choose the service that fits your pet, then send a request to the clinic.')}
    <section class="panel form-panel"><form data-form="booking"><h2>01 / Choose a service</h2><div class="service-grid">${options.map(s => `<button type="button" class="service-option ${state.selectedService === s.id ? 'selected' : ''}" data-service="${escapeHTML(s.id)}" aria-pressed="${state.selectedService === s.id}"><span aria-hidden="true">${s.icon}</span><span><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(s.description)}</small></span></button>`).join('')}</div><input type="hidden" name="serviceId" value="${escapeHTML(state.selectedService)}">
      <hr class="section-break"><h2>02 / Pick your pet and a time</h2>${state.data.pets.length ? `<div class="form-grid"><div class="field"><label for="booking-pet">Pet</label><select id="booking-pet" name="petId" required><option value="">Select a pet</option>${state.data.pets.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} · ${escapeHTML(p.species)}</option>`).join('')}</select></div>
        <div class="field"><label for="booking-date">Preferred date</label><input id="booking-date" type="date" name="date" min="${todayManila()}" required><small>Saturday or Sunday; within 90 days</small></div>
        <div class="field"><label for="booking-time">Preferred time</label><select id="booking-time" name="time" required><option value="">Select a time</option>${state.data.timeSlots.map(t => `<option value="${t}">${timeLabel(t)}</option>`).join('')}</select></div>
        <div class="field full"><label for="booking-note">Note for staff (optional)</label><textarea id="booking-note" name="note" maxlength="300" placeholder="Anything the clinic should know before confirming?"></textarea></div></div>
        <div class="form-actions"><span class="notice">${escapeHTML(state.data.demoSchedule)} A request is not a confirmed appointment.</span><button type="submit" class="btn btn-primary">Send appointment request →</button></div>` : empty('Add your pet first', 'A pet profile is needed before you can book.', '<button type="button" class="btn btn-primary btn-small" data-view="pets">Add a pet</button>')}
    </form></section>`;
}
function appointmentCard(a, staff) {
  let actions = '';
  if (staff && a.status === 'pending') actions = `<button class="btn btn-primary btn-small" data-action="confirm" data-id="${a.id}">Confirm</button><button class="btn btn-danger btn-small" data-action="reject" data-id="${a.id}">Decline</button>`;
  if (staff && a.status === 'confirmed') actions = `<button class="btn btn-primary btn-small" data-action="complete" data-id="${a.id}">Mark completed</button><button class="btn btn-outline btn-small" data-action="staff-cancel" data-id="${a.id}">Cancel</button>`;
  if (staff && a.status === 'completed' && !a.payment) actions = `<button class="btn btn-dark btn-small" data-action="payment-open" data-id="${a.id}">Record payment</button>`;
  if (!staff && a.status === 'pending') actions = `<button class="btn btn-outline btn-small" data-action="customer-cancel" data-id="${a.id}">Cancel request</button>`;
  return `<article class="appointment-card" data-appointment="${a.id}"><div class="appointment-head"><div><h3>${escapeHTML(a.serviceName)}</h3><p>Request ${escapeHTML(a.id.slice(0, 8))} · ${escapeHTML(a.petName)}${staff ? ` · ${escapeHTML(a.customerName)}` : ''}</p></div>${statusBadge(a.status)}</div>
    <div class="appointment-meta"><span>◷ &nbsp;${dateLabel(a.date)}</span><span>${timeLabel(a.time)} · PH time</span>${a.payment ? `<span>Paid · ${money(a.payment.amount)}</span>` : ''}</div>
    ${a.note ? `<p class="appointment-note"><strong>Customer note:</strong> ${escapeHTML(a.note)}</p>` : ''}${a.staffNote ? `<p class="appointment-note"><strong>Staff note:</strong> ${escapeHTML(a.staffNote)}</p>` : ''}
    <div class="appointment-foot"><span>${a.payment ? `Payment recorded: ${escapeHTML(a.payment.method)}${a.payment.reference ? ` · Ref ${escapeHTML(a.payment.reference)}` : ''}` : a.status === 'completed' ? 'No payment recorded yet' : a.status === 'pending' ? 'Waiting for staff review' : a.status === 'confirmed' ? 'Appointment confirmed' : 'Request closed'}</span><span class="appointment-actions">${actions}</span></div>
    ${staff && ['pending', 'confirmed'].includes(a.status) ? `<div class="field staff-note-field"><label for="staff-note-${a.id}">Optional note to customer</label><input id="staff-note-${a.id}" class="staff-note" maxlength="300" value="${escapeHTML(a.staffNote || '')}" placeholder="Add a short update"></div>` : ''}
    ${staff && state.paymentFor === a.id ? `<form data-form="payment" data-id="${a.id}" class="inline-form"><div class="form-grid"><div class="field"><label for="amount-${a.id}">Amount received (PHP)</label><input id="amount-${a.id}" type="number" name="amount" step="0.01" min="0.01" max="1000000" placeholder="e.g. 500.00" required></div><div class="field"><label for="method-${a.id}">Method</label><select id="method-${a.id}" name="method"><option>Cash</option><option>E-wallet</option><option>Other</option></select></div><div class="field full"><label for="reference-${a.id}">Reference (optional)</label><input id="reference-${a.id}" name="reference" maxlength="60" placeholder="Receipt or transaction reference"></div></div><button type="submit" class="btn btn-primary btn-small">Save payment record</button> <span class="helper">Records a received payment; does not charge a customer.</span></form>` : ''}</article>`;
}
function appointments(staff = false) {
  let items = state.data.appointments;
  if (staff && state.filter !== 'all') items = items.filter(a => a.status === state.filter);
  const filters = ['all', 'pending', 'confirmed', 'completed', 'rejected', 'cancelled'];
  return `${heading(staff ? 'Staff / appointments' : 'Your visits', staff ? 'Appointment queue' : 'My appointments', staff ? 'Review requests, confirm a service team, and close completed visits.' : 'Requests appear here with their latest status.', staff ? '' : '<button type="button" class="btn btn-primary" data-view="book">New request ＋</button>')}
    ${staff ? `<div class="filter-pills filter-row" aria-label="Appointment status filter">${filters.map(f => `<button type="button" class="${state.filter === f ? 'active' : ''}" data-filter="${f}" aria-pressed="${state.filter === f}">${titleCase(f)}${f === 'pending' ? ` · ${state.data.appointments.filter(a => a.status === f).length}` : ''}</button>`).join('')}</div>` : ''}
    <div class="appointment-list">${items.length ? items.map(a => appointmentCard(a, staff)).join('') : empty('Nothing here yet', staff ? 'Try another status filter or wait for a new request.' : 'Request a first visit to get started.', staff ? '' : '<button type="button" class="btn btn-primary btn-small" data-view="book">Book a visit</button>')}</div>`;
}
function pets() {
  return `${heading('Your companions', 'My pets', 'Save your pet’s basic details to make booking easier.')}
    <div class="two-col"><section><div class="pet-grid pet-grid-auto">${state.data.pets.length ? state.data.pets.map(p => `<article class="pet-card"><span class="pet-icon" aria-hidden="true">${p.species === 'Cat' ? '🐈' : p.species === 'Dog' ? '🐕' : '🐾'}</span><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.species)}${p.breed ? ` · ${escapeHTML(p.breed)}` : ''}</p><div class="divider"></div><small>${p.age ? `<strong>Age:</strong> ${escapeHTML(p.age)}` : 'Age not provided'}${p.notes ? `<br><strong>Note:</strong> ${escapeHTML(p.notes)}` : ''}</small></article>`).join('') : empty('No pets yet', 'Add your first companion using the form.')}</div></section>
    <section class="panel"><div class="panel-header"><div><h2>Add a pet</h2><p>Basic information only for this demo.</p></div></div><form data-form="pet"><div class="field"><label for="pet-name">Pet name</label><input id="pet-name" name="name" maxlength="80" placeholder="e.g. Milo" required></div><div class="field"><label for="pet-species">Type</label><select id="pet-species" name="species"><option>Dog</option><option>Cat</option><option>Other</option></select></div><div class="form-grid"><div class="field"><label for="pet-breed">Breed (optional)</label><input id="pet-breed" name="breed" maxlength="80" placeholder="e.g. Aspin"></div><div class="field"><label for="pet-age">Age (optional)</label><input id="pet-age" name="age" maxlength="40" placeholder="e.g. 2 years"></div></div><div class="field"><label for="pet-notes">General note (optional)</label><textarea id="pet-notes" name="notes" maxlength="300" placeholder="For demo use only; avoid real medical records."></textarea></div><button type="submit" class="btn btn-primary">Save pet profile</button></form></section></div>`;
}
function reports() {
  const counts = state.report?.counts || Object.fromEntries(['pending', 'confirmed', 'completed', 'rejected', 'cancelled'].map(k => [k, state.data.appointments.filter(a => a.status === k).length]));
  const total = state.report?.amountCollected ?? state.data.appointments.reduce((sum, a) => sum + (a.payment?.amount || 0), 0);
  return `${heading('Staff / reporting', 'At a glance', 'Simple totals from this local demo database.')}
    <div class="report-grid"><div class="report-card"><small>Total appointments</small><strong>${state.data.appointments.length}</strong></div><div class="report-card"><small>Waiting for review</small><strong>${counts.pending}</strong></div><div class="report-card"><small>Recorded payments</small><strong>${money(total)}</strong></div></div>
    <section class="panel report-panel"><div class="panel-header"><h2>Appointment status breakdown</h2></div><div class="list">${Object.entries(counts).map(([status, count]) => `<div class="list-row"><div class="row-main"><strong>${titleCase(status)}</strong></div><strong>${count}</strong></div>`).join('')}</div></section>
    <div class="info-card report-note"><strong>Report scope</strong>Counts include demo requests saved on this computer. Payment totals include only amounts staff manually recorded after completed appointments; they are not an accounting ledger or online payments.</div>`;
}
function render() {
  if (!state.data) return;
  if (!state.data.user) return renderAuth();
  const staff = state.data.user.role === 'staff';
  if (staff && !['overview', 'queue', 'reports'].includes(state.view)) state.view = 'overview';
  if (!staff && !['overview', 'book', 'appointments', 'pets'].includes(state.view)) state.view = 'overview';
  renderShell(({ overview, book: booking, appointments: () => appointments(false), pets, queue: () => appointments(true), reports })[state.view]());
}
async function navigate(view) {
  state.view = view; state.paymentFor = null; render();
  if (view === 'reports' && state.data.user?.role === 'staff') {
    try { state.report = await api('/api/report'); render(); } catch (error) { toast(error.message, true); }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
root.addEventListener('click', async event => {
  const button = event.target.closest('button, a');
  if (!button || !root.contains(button)) return;
  if (button.dataset.view) { event.preventDefault(); await navigate(button.dataset.view); return; }
  if (button.dataset.authMode) { state.authMode = button.dataset.authMode; render(); return; }
  if (button.dataset.fill) {
    state.authMode = 'login'; render();
    root.querySelector('#auth-email').value = button.dataset.fill === 'staff' ? 'staff@petserve.test' : 'alex@example.test';
    root.querySelector('#auth-password').value = 'Petserve123!';
    return;
  }
  if (button.dataset.service) {
    state.selectedService = button.dataset.service;
    root.querySelector('input[name=serviceId]').value = state.selectedService;
    root.querySelectorAll('[data-service]').forEach(b => { b.classList.toggle('selected', b.dataset.service === state.selectedService); b.setAttribute('aria-pressed', String(b.dataset.service === state.selectedService)); });
    return;
  }
  if (button.dataset.filter) { state.filter = button.dataset.filter; render(); return; }
  const action = button.dataset.action;
  if (!action) return;
  try {
    if (action === 'logout') { await api('/api/auth/logout', 'POST', {}); state.view = 'overview'; state.report = null; await refresh(); return; }
    if (action === 'payment-open') { state.paymentFor = state.paymentFor === button.dataset.id ? null : button.dataset.id; render(); return; }
    const id = button.dataset.id;
    const status = ({ confirm: 'confirmed', reject: 'rejected', complete: 'completed', 'staff-cancel': 'cancelled', 'customer-cancel': 'cancelled' })[action];
    if (status && id) {
      const staffNote = button.closest('[data-appointment]')?.querySelector('.staff-note')?.value || '';
      await api(`/api/appointments/${encodeURIComponent(id)}/status`, 'PATCH', { status, staffNote });
      await refresh();
      toast(`Appointment ${status}.`);
    }
  } catch (error) { toast(error.message, true); }
});
root.addEventListener('submit', async event => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form).entries());
  const button = form.querySelector('[type=submit]');
  if (button) button.disabled = true;
  try {
    switch (form.dataset.form) {
      case 'auth':
        await api(state.authMode === 'register' ? '/api/auth/register' : '/api/auth/login', 'POST', values);
        state.view = 'overview'; await refresh(); toast(`Welcome to PetServe!`); break;
      case 'pet':
        await api('/api/pets', 'POST', values); await refresh(); toast('Pet profile saved.'); break;
      case 'booking':
        await api('/api/appointments', 'POST', values); state.view = 'appointments'; await refresh(); toast('Request sent. Staff will review this slot.'); break;
      case 'payment':
        await api(`/api/appointments/${encodeURIComponent(form.dataset.id)}/payment`, 'POST', values);
        state.paymentFor = null; await refresh(); toast('Payment record saved.'); break;
    }
  } catch (error) { toast(error.message, true); if (button) button.disabled = false; }
});
refresh().catch(() => { root.innerHTML = '<div class="auth-side unavailable"><div class="auth-card"><h2>Can’t reach PetServe</h2><p>Start the local server with <code>node server.js</code>, then reload this page.</p></div></div>'; });
