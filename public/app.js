/* PetServe UI: 50% Scope Edition with Pet Photos, Online Payments & Pet Medical History. */
const root = document.querySelector('#app');
const toastElement = document.querySelector('#toast');
const state = {
  data: null,
  view: 'overview',
  authMode: 'login',
  selectedService: 'grooming',
  selectedTimeSlot: '',
  filter: 'all',
  paymentFor: null,
  onlinePayFor: null,
  selectedPetForHistory: null,
  editingPetPhoto: '',
  report: null
};

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const titleCase = value => value ? value[0].toUpperCase() + value.slice(1) : '';
const money = cents => '₱' + (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = date => new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = time => {
  if (!time) return '';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
};

function todayManila() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/* Preset High Quality Pet Avatars (Data URLs / Pure SVG Data) */
const PRESET_PET_PHOTOS = [
  { name: 'Golden Dog', url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=300&auto=format&fit=crop&q=80' },
  { name: 'Husky Dog', url: 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=300&auto=format&fit=crop&q=80' },
  { name: 'Playful Puppy', url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=300&auto=format&fit=crop&q=80' },
  { name: 'Cute Cat', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&auto=format&fit=crop&q=80' },
  { name: 'Fluffy Kitten', url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=300&auto=format&fit=crop&q=80' }
];

/* Crisp SVG Icon Definitions */
const icons = {
  brand: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5c-1.5 0-2.8 1.2-2.8 2.7 0 2.2 2.8 4.3 2.8 4.3s2.8-2.1 2.8-4.3C14.8 6.2 13.5 5 12 5z"/><path d="M7 9c-1.2 0-2.2.9-2.2 2 0 1.6 2.2 3.2 2.2 3.2s2.2-1.6 2.2-3.2c0-1.1-1-2-2.2-2z"/><path d="M17 9c-1.2 0-2.2.9-2.2 2 0 1.6 2.2 3.2 2.2 3.2s2.2-1.6 2.2-3.2c0-1.1-1-2-2.2-2z"/><path d="M12 14c-3.2 0-6 1.8-6 4 0 1.5 2.7 3 6 3s6-1.5 6-3c0-2.2-2.8-4-6-4z"/></svg>`,
  overview: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>`,
  queue: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>`,
  pets: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  reports: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  grooming: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
  vaccination: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  deworming: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
  calendar: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  sparkle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  card: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`
};

function serviceIcon(id) {
  return icons[id] || icons.sparkle;
}

function toast(message, error = false) {
  toastElement.innerHTML = `${error ? '⚠️' : '✓'} &nbsp;<span>${escapeHTML(message)}</span>`;
  toastElement.classList.toggle('error', error);
  toastElement.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastElement.classList.remove('show'), 3800);
}

async function api(route, method = 'GET', data) {
  const response = await fetch(route, {
    method,
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    credentials: 'same-origin'
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}

async function refresh() {
  state.data = await api('/api/bootstrap');
  render();
}

function brand() {
  return `<span class="brand-mark" aria-hidden="true">${icons.brand}</span><span>PetServe<span class="brand-dot">.</span></span>`;
}

function petAvatarHTML(pet, size = 56) {
  if (pet.photoUrl) {
    return `<img src="${escapeHTML(pet.photoUrl)}" alt="${escapeHTML(pet.name)}" class="pet-avatar-img" style="width:${size}px; height:${size}px;" onerror="this.onerror=null; this.parentNode.innerHTML='<span class=\\'pet-icon\\'>${pet.species === 'Cat' ? '🐈' : pet.species === 'Dog' ? '🐕' : '🐾'}</span>';">`;
  }
  return `<span class="pet-icon" style="width:${size}px; height:${size}px;">${pet.species === 'Cat' ? '🐈' : pet.species === 'Dog' ? '🐕' : '🐾'}</span>`;
}

function renderAuth() {
  const registering = state.authMode === 'register';
  root.innerHTML = `<div class="auth-shell">
    <section class="auth-story">
      <a class="brand" href="/">${brand()}</a>
      <div class="story-main">
        <span class="eyebrow">Petopia Pet Care Services</span>
        <h1>Good care starts<br>with a plan.</h1>
        <p>One simple place for pet photos, visit requests, online payments, and complete health history.</p>
        <div class="story-features">
          <span>01 &nbsp;Pet profiles & photos</span>
          <span>02 &nbsp;Online payments</span>
          <span>03 &nbsp;Vaccine & health logs</span>
        </div>
        <div class="story-card-preview">
          <div class="preview-header">
            <strong>Saturday Grooming</strong>
            <span class="status confirmed">● Paid Online</span>
          </div>
          <p>Milo · 10:00 AM Manila Time</p>
        </div>
      </div>
      <div class="story-footer">50% Scope Presentation Prototype. Pet pictures, online payments, and service history demo ready.</div>
    </section>
    <section class="auth-side">
      <div class="auth-card">
        <span class="eyebrow">Welcome to PetServe</span>
        <h2>${registering ? 'Create your account' : 'Sign in to your space'}</h2>
        <p>${registering ? 'Start with a customer account, then add your first pet.' : 'Keep your pet’s visits organized from request to receipt.'}</p>
        <div class="auth-tabs" role="tablist" aria-label="Account options">
          <button type="button" data-auth-mode="login" class="${registering ? '' : 'active'}" role="tab" aria-selected="${!registering}">Sign in</button>
          <button type="button" data-auth-mode="register" class="${registering ? 'active' : ''}" role="tab" aria-selected="${registering}">Create account</button>
        </div>
        <form data-form="auth">
          ${registering ? `<div class="field"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" maxlength="80" placeholder="Your full name" required></div>` : ''}
          <div class="field">
            <label for="auth-email">Email address</label>
            <input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
          </div>
          <div class="field">
            <label for="auth-password">Password</label>
            <input id="auth-password" name="password" type="password" autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? 8 : 1}" placeholder="${registering ? 'At least 8 characters' : 'Enter your password'}" required>
          </div>
          <button class="btn btn-primary btn-block" type="submit">${registering ? 'Create customer account' : 'Sign in'} <span aria-hidden="true">→</span></button>
        </form>
        <div class="demo-box">
          <strong>Presentation demo accounts</strong>
          Customer: <code>alex@example.test</code><br>
          Staff: <code>staff@petserve.test</code><br>
          Password for both: <code>Petserve123!</code>
          <div class="demo-box-actions">
            <button type="button" class="btn btn-soft btn-small" data-fill="customer">Fill customer</button>
            <button type="button" class="btn btn-soft btn-small" data-fill="staff">Fill staff</button>
          </div>
        </div>
      </div>
    </section>
  </div>`;
}

function navItems() {
  return state.data.user.role === 'staff'
    ? [['overview', icons.overview, 'Overview'], ['queue', icons.queue, 'Appointment queue'], ['reports', icons.reports, 'Reports']]
    : [['overview', icons.overview, 'Overview'], ['book', icons.book, 'Book a visit'], ['appointments', icons.queue, 'My appointments'], ['pets', icons.pets, 'My pets']];
}

function renderShell(content) {
  const u = state.data.user;
  root.innerHTML = `<div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="/" data-view="overview">${brand()}</a>
      <div>
        <div class="workspace-label">Workspace</div>
        <nav class="side-nav" aria-label="Main navigation">
          ${navItems().map(([key, icon, name]) => `<button type="button" data-view="${key}" class="${state.view === key ? 'active' : ''}" ${state.view === key ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${name}</span></button>`).join('')}
        </nav>
      </div>
      <div class="sidebar-bottom">
        <div class="sidebar-note">
          <strong>Local prototype · 50% scope</strong>
          Pet profiles & photos, online payments, service & vaccine history.
        </div>
        <div class="profile-mini">
          <span class="avatar" aria-hidden="true">${escapeHTML(u.name[0].toUpperCase())}</span>
          <div>
            <strong>${escapeHTML(u.name)}</strong>
            <small>${u.role === 'staff' ? 'Staff workspace' : 'Pet owner'}</small>
          </div>
          <button type="button" data-action="logout" aria-label="Sign out" title="Sign out">${icons.logout}</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div>PetServe <span aria-hidden="true">/</span> <strong>${escapeHTML(navItems().find(i => i[0] === state.view)?.[2] || 'Overview')}</strong></div>
        <span class="date-chip"><span>${icons.calendar}</span>${dateLabel(todayManila())} · PH time</span>
      </header>
      <main class="content">${content}</main>
    </div>
  </div>`;
}

function heading(kicker, headingText, subtitle, right = '') {
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${headingText}</h1><p>${subtitle}</p></div>${right}</div>`;
}

function statusBadge(value) {
  return `<span class="status ${escapeHTML(value)}">● ${titleCase(value)}</span>`;
}

function empty(title, detail, action = '') {
  return `<div class="empty"><strong>${title}</strong>${detail}${action ? `<div class="empty-action">${action}</div>` : ''}</div>`;
}

function overview() {
  const staff = state.data.user.role === 'staff', items = state.data.appointments;
  const pending = items.filter(a => a.status === 'pending').length;
  const confirmed = items.filter(a => a.status === 'confirmed').length;
  const paid = items.reduce((sum, a) => sum + (a.payment?.amount || 0), 0);
  const recent = [...items].slice(0, 4);

  return `${heading('Home / at a glance', `Hello, ${escapeHTML(state.data.user.name.split(' ')[0])}.`, staff ? 'Here is your appointment desk for today.' : 'A little planning makes every visit easier.')}
    <section class="hero">
      <div>
        <span class="eyebrow">${staff ? 'Clinic workspace' : 'Care made simpler'}</span>
        <h2>${staff ? 'Keep every visit on track.' : 'A happier visit begins here.'}</h2>
        <p>${staff ? 'Review booking requests, confirm availability, and record payments after completed services.' : 'Create a pet profile with picture, request a visit, and pay online directly.'}</p>
        <button type="button" class="btn" data-view="${staff ? 'queue' : 'book'}">${staff ? 'Open appointment queue' : 'Book an appointment'} <span aria-hidden="true">→</span></button>
      </div>
      <span class="hero-art" aria-hidden="true">✿</span>
    </section>
    <div class="stats">
      <div class="stat">
        <span>Awaiting confirmation</span>
        <strong>${pending}</strong>
        <small>Pending requests</small>
      </div>
      <div class="stat">
        <span>Confirmed visits</span>
        <strong>${confirmed}</strong>
        <small>Ready to welcome</small>
      </div>
      <div class="stat">
        <span>${staff ? 'Recorded collection' : 'My pets'}</span>
        <strong>${staff ? money(paid) : state.data.pets.length}</strong>
        <small>${staff ? 'Manual & online payment records' : 'Pet profiles saved'}</small>
      </div>
    </div>
    <div class="two-col">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Recent appointments</h2>
            <p>Latest requests, online payments, and status updates</p>
          </div>
          <button type="button" class="link" data-view="${staff ? 'queue' : 'appointments'}">View all →</button>
        </div>
        ${recent.length ? `<div class="list">${recent.map(a => `<div class="list-row"><div class="row-start"><span class="row-icon" aria-hidden="true">${serviceIcon(a.serviceId)}</span><div class="row-main"><strong>${escapeHTML(a.serviceName)} · ${escapeHTML(a.petName)}</strong><small>${dateLabel(a.date)} · ${timeLabel(a.time)}${staff ? ` · ${escapeHTML(a.customerName)}` : ''}</small></div></div>${statusBadge(a.status)}</div>`).join('')}</div>` : empty('No appointments yet', staff ? 'Customer requests will appear here.' : 'Your upcoming visits will show up after you book one.')}
      </section>
      <div>
        <section class="panel">
          <div class="panel-header">
            <h2>50% Scope Features</h2>
          </div>
          <div class="info-card">
            <strong>1 · Pet Pictures & Medical Log</strong>
            Add pictures for your pets and track full vaccination & service history.
          </div>
          <div class="quick-card">
            <strong>2 · Customer Online Payments</strong>
            <p>Customers can pay directly online via GCash, Maya, or Credit Card for instant digital receipt generation.</p>
          </div>
        </section>
      </div>
    </div>`;
}

function booking() {
  const options = state.data.services;
  return `${heading('New appointment', 'Let’s plan a visit.', 'Choose the service that fits your pet, then send a request to the clinic.')}
    <section class="panel form-panel">
      <form data-form="booking">
        <h2>01 / Choose a service</h2>
        <div class="service-grid">
          ${options.map(s => `
            <button type="button" class="service-option ${state.selectedService === s.id ? 'selected' : ''}" data-service="${escapeHTML(s.id)}" aria-pressed="${state.selectedService === s.id}">
              <span aria-hidden="true">${serviceIcon(s.id)}</span>
              <span>
                <span class="service-badge">${escapeHTML(s.group || 'Service')}</span>
                <strong>${escapeHTML(s.name)}</strong>
                <small>${escapeHTML(s.description)} · <strong>${money(s.basePrice || 40000)}</strong></small>
              </span>
            </button>
          `).join('')}
        </div>
        <input type="hidden" name="serviceId" value="${escapeHTML(state.selectedService)}">
        <hr class="section-break">
        <h2>02 / Pick your pet and a time</h2>
        ${state.data.pets.length ? `
          <div class="form-grid">
            <div class="field full">
              <label for="booking-pet">Select Pet Profile</label>
              <select id="booking-pet" name="petId" required>
                <option value="">Select a pet profile</option>
                ${state.data.pets.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} (${escapeHTML(p.species)}${p.breed ? ` - ${escapeHTML(p.breed)}` : ''})</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="booking-date">Preferred date</label>
              <input id="booking-date" type="date" name="date" min="${todayManila()}" required>
              <small>Saturday or Sunday; within 90 days</small>
            </div>
            <div class="field">
              <label for="booking-time">Preferred time slot</label>
              <select id="booking-time" name="time" required>
                <option value="">Select a time</option>
                ${state.data.timeSlots.map(t => `<option value="${t}" ${state.selectedTimeSlot === t ? 'selected' : ''}>${timeLabel(t)}</option>`).join('')}
              </select>
              <small>Operating hours: 9:00 AM - 4:00 PM</small>
            </div>
            <div class="field full">
              <div class="time-slots-container">
                <label>Quick time picker</label>
                <div class="time-slots-grid">
                  ${state.data.timeSlots.map(t => `
                    <button type="button" class="time-slot-btn ${state.selectedTimeSlot === t ? 'selected' : ''}" data-time-slot="${t}">${timeLabel(t)}</button>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="field full">
              <label for="booking-note">Note for staff (optional)</label>
              <textarea id="booking-note" name="note" maxlength="300" placeholder="Anything the clinic should know before confirming? (e.g. skin allergies, temperament)"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <span class="notice">ℹ &nbsp;${escapeHTML(state.data.demoSchedule)} You can also pay online after submitting.</span>
            <div style="display:flex; gap:10px; align-items:center;">
              <button type="button" class="btn btn-outline" data-view="appointments">Cancel</button>
              <button type="submit" class="btn btn-primary">Send appointment request →</button>
            </div>
          </div>
        ` : empty('Add your pet first', 'A pet profile is needed before you can book.', '<button type="button" class="btn btn-primary btn-small" data-view="pets">Add a pet</button>')}
      </form>
    </section>`;
}

function appointmentCard(a, staff) {
  let actions = '';
  if (staff && a.status === 'pending') actions = `<button class="btn btn-primary btn-small" data-action="confirm" data-id="${a.id}">Confirm</button><button class="btn btn-danger btn-small" data-action="reject" data-id="${a.id}">Decline</button>`;
  if (staff && a.status === 'confirmed') actions = `<button class="btn btn-primary btn-small" data-action="complete" data-id="${a.id}">Mark completed</button><button class="btn btn-outline btn-small" data-action="staff-cancel" data-id="${a.id}">Cancel</button>`;
  if (staff && a.status === 'completed' && !a.payment) actions = `<button class="btn btn-dark btn-small" data-action="payment-open" data-id="${a.id}">Record payment</button>`;

  if (!staff) {
    if (!a.payment && ['pending', 'confirmed'].includes(a.status)) {
      actions += `<button class="btn btn-accent btn-small" data-action="online-pay-open" data-id="${a.id}">${icons.card} Pay Online</button> `;
    }
    if (!a.payment && ['pending', 'confirmed'].includes(a.status)) {
      actions += `<button class="btn btn-outline btn-small" data-action="customer-cancel" data-id="${a.id}">Cancel appointment</button>`;
    }
  }

  const service = state.data?.services?.find(s => s.id === a.serviceId);
  const estAmount = service?.basePrice || 40000;

  return `<article class="appointment-card" data-appointment="${a.id}">
    <div class="appointment-head">
      <div>
        <h3>${escapeHTML(a.serviceName)}</h3>
        <p>Request #${escapeHTML(a.id.slice(0, 8))} · <strong>${escapeHTML(a.petName)}</strong>${staff ? ` · Customer: ${escapeHTML(a.customerName)}` : ''}</p>
      </div>
      ${statusBadge(a.status)}
    </div>
    <div class="appointment-meta">
      <span>${icons.calendar} &nbsp;${dateLabel(a.date)}</span>
      <span>${icons.clock} &nbsp;${timeLabel(a.time)}</span>
      ${a.payment ? `<span style="color:#166534; background:#dcfce7; border-color:#bbf7d0;">✓ Paid · ${money(a.payment.amount)} (${escapeHTML(a.payment.method)})</span>` : `<span>Est. Price: ${money(estAmount)}</span>`}
    </div>
    ${a.note ? `<div class="appointment-note"><strong>Customer note:</strong> ${escapeHTML(a.note)}</div>` : ''}
    ${a.staffNote ? `<div class="appointment-note"><strong>Staff response:</strong> ${escapeHTML(a.staffNote)}</div>` : ''}

    ${a.payment ? `
      <div class="receipt-card">
        <div class="receipt-header">
          <strong>Digital Receipt #${escapeHTML(a.payment.reference || a.payment.id.slice(0, 8))}</strong>
          <span class="status completed">Paid via ${escapeHTML(a.payment.method)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>${escapeHTML(a.serviceName)} (${escapeHTML(a.petName)})</span>
          <strong>${money(a.payment.amount)}</strong>
        </div>
        <div style="font-size:11px; color:var(--text-muted);">Recorded on ${new Date(a.payment.recordedAt).toLocaleString('en-PH')}</div>
      </div>
    ` : ''}

    <div class="appointment-foot">
      <span>${a.payment ? `Paid in full` : a.status === 'completed' ? 'Service completed · Payment pending' : a.status === 'pending' ? 'Awaiting clinic review or online payment' : a.status === 'confirmed' ? 'Appointment confirmed' : 'Request closed'}</span>
      <span class="appointment-actions">${actions}</span>
    </div>

    ${staff && ['pending', 'confirmed'].includes(a.status) ? `<div class="field staff-note-field"><label for="staff-note-${a.id}">Optional update for customer</label><input id="staff-note-${a.id}" class="staff-note" maxlength="300" value="${escapeHTML(a.staffNote || '')}" placeholder="Add a short update note..."></div>` : ''}
    ${staff && state.paymentFor === a.id ? `
      <form data-form="payment" data-id="${a.id}" class="inline-form">
        <div class="form-grid">
          <div class="field">
            <label for="amount-${a.id}">Amount received (PHP)</label>
            <input id="amount-${a.id}" type="number" name="amount" step="0.01" min="0.01" max="1000000" value="${(estAmount / 100).toFixed(2)}" required>
          </div>
          <div class="field">
            <label for="method-${a.id}">Payment Method</label>
            <select id="method-${a.id}" name="method">
              <option>Cash</option>
              <option>E-wallet</option>
              <option>GCash</option>
              <option>Maya</option>
              <option>Other</option>
            </select>
          </div>
          <div class="field full">
            <label for="reference-${a.id}">Reference # (optional)</label>
            <input id="reference-${a.id}" name="reference" maxlength="60" placeholder="Receipt or transaction reference">
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
          <button type="submit" class="btn btn-primary btn-small">Save payment record</button>
          <span class="helper">Records a received payment; updates appointment status.</span>
        </div>
      </form>
    ` : ''}

    ${!staff && state.onlinePayFor === a.id ? renderOnlinePayModal(a, estAmount) : ''}
  </article>`;
}

function renderOnlinePayModal(a, estAmount) {
  return `<div class="modal-backdrop show">
    <div class="modal-card">
      <div class="modal-header">
        <h2>Online Payment Checkout</h2>
        <button type="button" class="modal-close-btn" data-action="online-pay-close">✕</button>
      </div>
      <p style="color:var(--text-muted); font-size:13px;">Pay for <strong>${escapeHTML(a.serviceName)}</strong> (${escapeHTML(a.petName)}) directly online for instant confirmation.</p>
      <div class="receipt-card" style="margin:16px 0;">
        <div style="display:flex; justify-content:space-between; font-size:16px;">
          <strong>Total Amount Due:</strong>
          <strong style="color:var(--primary); font-size:20px;">${money(estAmount)}</strong>
        </div>
      </div>
      <form data-form="online-payment" data-id="${a.id}">
        <input type="hidden" name="amount" value="${(estAmount / 100).toFixed(2)}">
        <label style="font-weight:700; font-size:13px; display:block; margin-bottom:8px;">Choose Payment Channel</label>
        <div class="payment-methods-grid">
          <label class="payment-method-card selected">
            <input type="radio" name="method" value="GCash" checked style="accent-color:var(--primary);">
            <strong>📱 GCash</strong>
          </label>
          <label class="payment-method-card">
            <input type="radio" name="method" value="Maya" style="accent-color:var(--primary);">
            <strong>📱 Maya</strong>
          </label>
          <label class="payment-method-card">
            <input type="radio" name="method" value="Credit Card" style="accent-color:var(--primary);">
            <strong>💳 Card</strong>
          </label>
        </div>
        <div class="field" style="margin-top:16px;">
          <label for="online-ref">Account / Reference #</label>
          <input id="online-ref" name="reference" placeholder="e.g. 0917XXXXXXX or Ref #109283" required>
        </div>
        <div style="display:flex; gap:10px; margin-top:20px;">
          <button type="submit" class="btn btn-accent btn-block">Confirm Online Payment (${money(estAmount)})</button>
          <button type="button" class="btn btn-outline" data-action="online-pay-close">Cancel</button>
        </div>
      </form>
    </div>
  </div>`;
}

function appointments(staff = false) {
  let items = state.data.appointments;
  if (staff && state.filter !== 'all') items = items.filter(a => a.status === state.filter);
  const filters = ['all', 'pending', 'confirmed', 'completed', 'rejected', 'cancelled'];

  return `${heading(staff ? 'Staff / appointments' : 'Your visits', staff ? 'Appointment queue' : 'My appointments', staff ? 'Review requests, confirm schedule availability, and record payment.' : 'Requests appear here with real-time status and online payment option.', staff ? '' : '<button type="button" class="btn btn-primary" data-view="book">New request ＋</button>')}
    ${staff ? `<div class="filter-pills filter-row" aria-label="Appointment status filter">${filters.map(f => `<button type="button" class="${state.filter === f ? 'active' : ''}" data-filter="${f}" aria-pressed="${state.filter === f}">${titleCase(f)}${f === 'pending' ? ` (${state.data.appointments.filter(a => a.status === f).length})` : ''}</button>`).join('')}</div>` : ''}
    <div class="appointment-list">${items.length ? items.map(a => appointmentCard(a, staff)).join('') : empty('Nothing here yet', staff ? 'Try another status filter or wait for a new request.' : 'Request a first visit to get started.', staff ? '' : '<button type="button" class="btn btn-primary btn-small" data-view="book">Book a visit</button>')}</div>`;
}

function pets() {
  const selectedPet = state.selectedPetForHistory ? state.data.pets.find(p => p.id === state.selectedPetForHistory) : null;

  return `${heading('Your companions', 'My pets', 'Save your pet’s picture, view medical & vaccination history, and book visits.')}
    <div class="two-col">
      <section>
        <div class="pet-grid">
          ${state.data.pets.length ? state.data.pets.map(p => `
            <article class="pet-card">
              <div class="pet-avatar-wrapper">
                ${petAvatarHTML(p, 72)}
                <span class="pet-species-badge">${escapeHTML(p.species)}</span>
              </div>
              <h3>${escapeHTML(p.name)}</h3>
              <p>${p.breed ? escapeHTML(p.breed) : escapeHTML(p.species)}</p>
              <div class="divider"></div>
              <small>
                ${p.age ? `<strong>Age:</strong> ${escapeHTML(p.age)}` : 'Age not provided'}
                ${p.notes ? `<br><strong>Note:</strong> ${escapeHTML(p.notes)}` : ''}
              </small>
              <div class="pet-card-actions">
                <button type="button" class="btn btn-soft btn-small btn-block" data-action="pet-history" data-id="${p.id}">View Pet History & Medical Log</button>
                <button type="button" class="btn btn-outline btn-small btn-block" data-view="book">Book Visit</button>
                <button type="button" class="btn btn-danger btn-small btn-block" data-action="pet-delete" data-id="${p.id}" data-name="${escapeHTML(p.name)}">Delete Pet</button>
              </div>
            </article>
          `).join('') : empty('No pets yet', 'Add your first companion using the form.')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Add / Edit Pet Profile</h2>
            <p>Upload a pet picture & save profile details.</p>
          </div>
        </div>
        <form data-form="pet">
          <div class="field">
            <label for="pet-name">Pet name</label>
            <input id="pet-name" name="name" maxlength="80" placeholder="e.g. Milo" required>
          </div>
          <div class="field">
            <label for="pet-species">Pet species</label>
            <select id="pet-species" name="species">
              <option>Dog</option>
              <option>Cat</option>
              <option>Other</option>
            </select>
          </div>
          <div class="field">
            <label>Pet Picture</label>
            <input type="hidden" id="pet-photo" name="photoUrl" value="${escapeHTML(state.editingPetPhoto)}">
            <input type="file" id="pet-file-input" accept="image/*" style="display:none;">
            <div class="import-image-wrapper">
              <div class="import-image-preview">
                ${state.editingPetPhoto ? `
                  <img src="${escapeHTML(state.editingPetPhoto)}" alt="Pet preview" class="imported-thumb">
                  <div>
                    <strong style="display:block; font-size:13px; color:var(--text-main);">Image imported</strong>
                    <small style="color:var(--text-muted); display:block; margin-bottom:6px;">Ready to save with pet profile</small>
                    <button type="button" class="btn btn-danger btn-small" data-action="remove-photo">Remove Image</button>
                  </div>
                ` : `
                  <div class="import-placeholder">
                    <span style="font-size:32px;">📷</span>
                    <div>
                      <strong style="display:block; font-size:13px; color:var(--text-main);">No picture imported</strong>
                      <small style="color:var(--text-muted);">Import a picture from your device or choose a preset</small>
                    </div>
                  </div>
                `}
              </div>
              <div style="display:flex; gap:10px; align-items:center; margin-top:8px;">
                <button type="button" class="btn btn-soft btn-small" data-action="trigger-import">📁 Import Image</button>
                ${state.editingPetPhoto ? `<button type="button" class="btn btn-outline btn-small" data-action="remove-photo">Clear</button>` : ''}
              </div>
            </div>
            <small style="margin-top:10px; display:block;">Or choose a quick preset avatar:</small>
            <div class="preset-photo-grid">
              ${PRESET_PET_PHOTOS.map(ph => `
                <button type="button" class="preset-photo-btn ${state.editingPetPhoto === ph.url ? 'selected' : ''}" data-photo="${escapeHTML(ph.url)}" title="${ph.name}">
                  <img src="${ph.url}" alt="${ph.name}">
                </button>
              `).join('')}
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="pet-breed">Breed (optional)</label>
              <input id="pet-breed" name="breed" maxlength="80" placeholder="e.g. Aspin / Golden">
            </div>
            <div class="field">
              <label for="pet-age">Age (optional)</label>
              <input id="pet-age" name="age" maxlength="40" placeholder="e.g. 2 years">
            </div>
          </div>
          <div class="field">
            <label for="pet-notes">Special instructions or notes (optional)</label>
            <textarea id="pet-notes" name="notes" maxlength="300" placeholder="Dietary restrictions, allergies, behavior notes..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Save Pet Profile</button>
        </form>
      </section>
    </div>
    ${selectedPet ? renderPetHistoryModal(selectedPet) : ''}`;
}

function renderPetHistoryModal(pet) {
  const petApps = (state.data.appointments || []).filter(a => a.petId === pet.id);
  const petLogs = (state.data.healthLogs || []).filter(h => h.petId === pet.id);

  return `<div class="modal-backdrop show">
    <div class="modal-card pet-history-modal" role="dialog" aria-modal="true" aria-labelledby="pet-history-title">
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:16px;">
          ${petAvatarHTML(pet, 56)}
          <div>
            <h2 id="pet-history-title">${escapeHTML(pet.name)}'s Service & Medical History</h2>
            <p style="margin:0; color:var(--text-muted); font-size:13px;">${escapeHTML(pet.species)}${pet.breed ? ` · ${escapeHTML(pet.breed)}` : ''}${pet.age ? ` · ${escapeHTML(pet.age)}` : ''}</p>
          </div>
        </div>
        <button type="button" class="modal-close-btn" data-action="history-close">✕</button>
      </div>

      <div class="pet-history-container">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3>Vaccination & Health Log</h3>
            <button type="button" class="btn btn-soft btn-small" data-action="toggle-health-form">+ Add Health Record</button>
          </div>
          
          <form data-form="health-log" data-id="${pet.id}" class="inline-form" style="display:none; margin-bottom:16px;">
            <div class="form-grid">
              <div class="field">
                <label for="health-title">Record Title / Vaccine Name</label>
                <input id="health-title" name="title" placeholder="e.g. 5-in-1 Vaccine / Rabies Shot" required>
              </div>
              <div class="field">
                <label for="health-type">Record Type</label>
                <select id="health-type" name="type">
                  <option value="vaccine">Vaccine 💉</option>
                  <option value="deworming">Deworming 💊</option>
                  <option value="medical">General Medical 🩺</option>
                </select>
              </div>
              <div class="field">
                <label for="health-date">Date Administered</label>
                <input id="health-date" type="date" name="date" value="${todayManila()}" required>
              </div>
              <div class="field">
                <label for="health-notes">Clinical Notes</label>
                <input id="health-notes" name="notes" placeholder="e.g. Next due in 1 year">
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-small">Save Health Log</button>
          </form>

          ${petLogs.length ? `
            <div class="history-timeline">
              ${petLogs.map(h => `
                <div class="timeline-item ${escapeHTML(h.type)}">
                  <div class="timeline-header">
                    <strong>${h.type === 'vaccine' ? '💉 Vaccine:' : h.type === 'deworming' ? '💊 Deworming:' : '🩺 Medical:'} ${escapeHTML(h.title)}</strong>
                    <small>${dateLabel(h.date)}</small>
                  </div>
                  ${h.notes ? `<p>${escapeHTML(h.notes)}</p>` : ''}
                </div>
              `).join('')}
            </div>
          ` : '<p style="color:var(--text-muted); font-size:13px;">No medical logs recorded yet.</p>'}
        </div>

        <div style="margin-top:20px;">
          <h3>Grooming & Clinic Visits History</h3>
          ${petApps.length ? `
            <div class="history-timeline">
              ${petApps.map(a => `
                <div class="timeline-item">
                  <div class="timeline-header">
                    <strong>${serviceIcon(a.serviceId)} ${escapeHTML(a.serviceName)}</strong>
                    <small>${dateLabel(a.date)} · ${timeLabel(a.time)}</small>
                  </div>
                  <div style="margin-top:4px;">
                    ${statusBadge(a.status)}
                    ${a.payment ? `<span style="font-size:12px; margin-left:8px; color:#166534;">Paid ${money(a.payment.amount)}</span>` : ''}
                  </div>
                  ${a.staffNote ? `<p><strong>Staff Note:</strong> ${escapeHTML(a.staffNote)}</p>` : ''}
                </div>
              `).join('')}
            </div>
          ` : '<p style="color:var(--text-muted); font-size:13px;">No past appointment visits for this pet.</p>'}
        </div>
      </div>
    </div>
  </div>`;
}

function reports() {
  const counts = state.report?.counts || Object.fromEntries(['pending', 'confirmed', 'completed', 'rejected', 'cancelled'].map(k => [k, state.data.appointments.filter(a => a.status === k).length]));
  const total = state.report?.amountCollected ?? state.data.appointments.reduce((sum, a) => sum + (a.payment?.amount || 0), 0);
  const totalApps = state.data.appointments.length || 1;

  return `${heading('Staff / reporting', 'At a glance', 'Simple totals from this local demo database.')}
    <div class="report-grid">
      <div class="report-card">
        <small>Total appointments</small>
        <strong>${state.data.appointments.length}</strong>
      </div>
      <div class="report-card">
        <small>Waiting for review</small>
        <strong>${counts.pending}</strong>
      </div>
      <div class="report-card">
        <small>Recorded collections</small>
        <strong>${money(total)}</strong>
      </div>
    </div>
    <section class="panel report-panel" style="margin-top:24px;">
      <div class="panel-header">
        <h2>Appointment Status Breakdown</h2>
      </div>
      <div class="status-bar-container">
        ${Object.entries(counts).map(([status, count]) => {
          const pct = Math.round((count / totalApps) * 100);
          return `
            <div class="status-bar-item">
              <div class="status-bar-label">
                <span>${titleCase(status)}</span>
                <span>${count} (${pct}%)</span>
              </div>
              <div class="status-bar-track">
                <div class="status-bar-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
    <div class="info-card report-note" style="margin-top:20px;">
      <strong>Report scope & details</strong>
      Counts include demo requests saved in local database. Payment totals include online payments and manual records.
    </div>`;
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
  state.view = view;
  state.paymentFor = null;
  state.onlinePayFor = null;
  state.selectedPetForHistory = null;
  render();
  if (view === 'reports' && state.data.user?.role === 'staff') {
    try {
      state.report = await api('/api/report');
      render();
    } catch (error) {
      toast(error.message, true);
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

root.addEventListener('click', async event => {
  const button = event.target.closest('button, a');
  if (!button || !root.contains(button)) return;

  if (button.dataset.photo) {
    state.editingPetPhoto = button.dataset.photo;
    render();
    return;
  }
  if (button.dataset.view) {
    event.preventDefault();
    await navigate(button.dataset.view);
    return;
  }
  if (button.dataset.authMode) {
    state.authMode = button.dataset.authMode;
    render();
    return;
  }
  if (button.dataset.fill) {
    state.authMode = 'login';
    render();
    root.querySelector('#auth-email').value = button.dataset.fill === 'staff' ? 'staff@petserve.test' : 'alex@example.test';
    root.querySelector('#auth-password').value = 'Petserve123!';
    return;
  }
  if (button.dataset.service) {
    state.selectedService = button.dataset.service;
    const input = root.querySelector('input[name=serviceId]');
    if (input) input.value = state.selectedService;
    root.querySelectorAll('[data-service]').forEach(b => {
      b.classList.toggle('selected', b.dataset.service === state.selectedService);
      b.setAttribute('aria-pressed', String(b.dataset.service === state.selectedService));
    });
    return;
  }
  if (button.dataset.timeSlot) {
    state.selectedTimeSlot = button.dataset.timeSlot;
    const select = root.querySelector('#booking-time');
    if (select) select.value = state.selectedTimeSlot;
    root.querySelectorAll('[data-time-slot]').forEach(b => {
      b.classList.toggle('selected', b.dataset.timeSlot === state.selectedTimeSlot);
    });
    return;
  }
  if (button.dataset.filter) {
    state.filter = button.dataset.filter;
    render();
    return;
  }

  const action = button.dataset.action;
  if (!action) return;
  try {
    if (action === 'logout') {
      await api('/api/auth/logout', 'POST', {});
      state.view = 'overview';
      state.report = null;
      await refresh();
      return;
    }
    if (action === 'payment-open') {
      state.paymentFor = state.paymentFor === button.dataset.id ? null : button.dataset.id;
      render();
      return;
    }
    if (action === 'online-pay-open') {
      state.onlinePayFor = button.dataset.id;
      render();
      return;
    }
    if (action === 'online-pay-close') {
      state.onlinePayFor = null;
      render();
      return;
    }
    if (action === 'pet-history') {
      const pet = state.data.pets.find(item => item.id === button.dataset.id);
      if (!pet) throw new Error('This pet profile could not be found. Refresh and try again.');
      state.selectedPetForHistory = pet.id;
      render();
      return;
    }
    if (action === 'history-close') {
      state.selectedPetForHistory = null;
      render();
      return;
    }
    if (action === 'pet-delete') {
      const petName = button.dataset.name || 'this pet';
      if (!window.confirm(`Remove ${petName} from your pet profiles? Appointment and payment history will be kept.`)) return;
      await api(`/api/pets/${encodeURIComponent(button.dataset.id)}`, 'DELETE');
      state.selectedPetForHistory = null;
      await refresh();
      toast(`${petName}’s profile deleted.`);
      return;
    }
    if (action === 'toggle-health-form') {
      const form = root.querySelector('form[data-form="health-log"]');
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
      return;
    }
    if (action === 'trigger-import') {
      const fileInput = root.querySelector('#pet-file-input');
      if (fileInput) fileInput.click();
      return;
    }
    if (action === 'remove-photo') {
      state.editingPetPhoto = '';
      render();
      return;
    }
    const id = button.dataset.id;
    const status = ({ confirm: 'confirmed', reject: 'rejected', complete: 'completed', 'staff-cancel': 'cancelled', 'customer-cancel': 'cancelled' })[action];
    if (status && id) {
      const staffNote = button.closest('[data-appointment]')?.querySelector('.staff-note')?.value || '';
      await api(`/api/appointments/${encodeURIComponent(id)}/status`, 'PATCH', { status, staffNote });
      await refresh();
      toast(`Appointment ${status}.`);
    }
  } catch (error) {
    toast(error.message, true);
  }
});

function handleImageImport(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Please select a valid image file (PNG, JPG, etc.).', true);
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 400;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      state.editingPetPhoto = canvas.toDataURL('image/jpeg', 0.85);
      render();
      toast('Pet picture imported successfully!');
    };
    img.onerror = () => toast('Failed to read image file.', true);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

root.addEventListener('change', event => {
  if (event.target.id === 'pet-file-input') {
    const file = event.target.files?.[0];
    if (file) handleImageImport(file);
  }
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
        state.view = 'overview';
        await refresh();
        toast(`Welcome to PetServe!`);
        break;
      case 'pet':
        await api('/api/pets', 'POST', values);
        state.editingPetPhoto = '';
        await refresh();
        toast('Pet profile and photo saved.');
        break;
      case 'health-log':
        await api(`/api/pets/${encodeURIComponent(form.dataset.id)}/health-logs`, 'POST', values);
        await refresh();
        toast('Health log added.');
        break;
      case 'booking':
        await api('/api/appointments', 'POST', values);
        state.view = 'appointments';
        await refresh();
        toast('Request sent! You can also pay online for instant confirmation.');
        break;
      case 'online-payment':
        await api(`/api/appointments/${encodeURIComponent(form.dataset.id)}/online-payment`, 'POST', values);
        state.onlinePayFor = null;
        await refresh();
        toast('Online payment confirmed! Digital receipt generated.');
        break;
      case 'payment':
        await api(`/api/appointments/${encodeURIComponent(form.dataset.id)}/payment`, 'POST', values);
        state.paymentFor = null;
        await refresh();
        toast('Payment record saved.');
        break;
    }
  } catch (error) {
    toast(error.message, true);
    if (button) button.disabled = false;
  }
});

refresh().catch(() => {
  root.innerHTML = '<div class="auth-side unavailable"><div class="auth-card"><h2>Can’t reach PetServe</h2><p>Start the local server with <code>node server.js</code>, then reload this page.</p></div></div>';
});
