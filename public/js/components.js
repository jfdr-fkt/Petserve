import { icons, serviceIcon } from './icons.js';
import { escapeHTML as e, titleCase, money, dateLabel, timeLabel } from './utils.js';
export { serviceIcon };

const paths = {
  collapse: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-12-3 4 3 4"/>',
  expand: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m4-12 3 4-3 4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4v14H4z"/><circle cx="12" cy="13" r="4"/>',
  feedback:
    '<path d="M4 3h16v14H9l-5 4z"/><path d="m12 6 1.2 2.5L16 9l-2 2 .5 3-2.5-1.4L9.5 14l.5-3-2-2 2.8-.5z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  edit: '<path d="m15 5 4 4M4 20l4-1 12-12a3 3 0 0 0-4-4L4 15z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  settings: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  consultation:
    '<path d="M6 3v7a5 5 0 0 0 10 0V3M4 3h4m6 0h4M11 15v2a4 4 0 0 0 8 0v-3"/><circle cx="19" cy="11" r="3"/>',
};
export function icon(name) {
  return (
    icons[name] ||
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.plus}</svg>`
  );
}
export const brand = () =>
  `<span class="brand-mark">${icons.brand}</span><span>PetServe<span class="brand-dot">.</span><small>care, coordinated</small></span>`;
export const statusBadge = (status) =>
  `<span class="status ${e(status)}"><span class="status-dot"></span>${titleCase(status)}</span>`;
export const button = (label, action, glyph = '', kind = 'primary', attrs = '') =>
  `<button type="button" class="btn btn-${kind}" data-action="${action}" ${attrs}>${glyph ? icon(glyph) : ''}${label}</button>`;
export const viewButton = (label, view, glyph = '', kind = 'primary') =>
  `<button type="button" class="btn btn-${kind}" data-view="${view}">${glyph ? icon(glyph) : ''}${label}</button>`;
export const heading = (eyebrow, title, description, actions = '') =>
  `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div><div class="actions">${actions}</div></div>`;
export const empty = (title, description, action = '', glyph = 'pets') =>
  `<div class="empty-state"><span class="empty-icon">${icon(glyph)}</span><h3>${title}</h3><p>${description}</p>${action}</div>`;
export const stats = (items) =>
  `<div class="stats-grid">${items.map(([label, value, glyph, tone = 'sage', hint = '']) => `<div class="stat-card"><div><span class="stat-label">${label}</span><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ''}</div><span class="icon-tile ${tone}">${icon(glyph)}</span></div>`).join('')}</div>`;
export const field = (label, name, value = '', options = {}) => {
  const id = options.id || `field-${name}`;
  const attrs = `${options.required ? 'required' : ''} ${options.attrs || ''}`;
  const control = options.choices
    ? `<select id="${id}" name="${name}" ${attrs}>${options.choices
        .map((choice) => {
          const [key, text] = Array.isArray(choice) ? choice : [choice, choice];
          return `<option value="${e(key)}" ${String(value) === String(key) ? 'selected' : ''}>${e(text)}</option>`;
        })
        .join('')}</select>`
    : options.type === 'textarea'
      ? `<textarea id="${id}" name="${name}" ${attrs}>${e(value)}</textarea>`
      : `<input id="${id}" name="${name}" type="${options.type || 'text'}" value="${e(value)}" ${attrs} ${options.placeholder ? `placeholder="${e(options.placeholder)}"` : ''}>`;
  return `<div class="field"><label for="${id}">${label}</label>${control}${options.hint ? `<small>${options.hint}</small>` : ''}</div>`;
};
export function petAvatar(pet, size = 'md') {
  return `<div class="pet-avatar ${e(size)} ${pet.species === 'Cat' ? 'lavender' : 'peach'}">${pet.photoUrl ? `<img src="${e(pet.photoUrl)}" alt="${e(pet.name)}" loading="lazy">` : `<img src="/assets/${pet.species === 'Cat' ? 'cat' : 'dog'}.svg" alt="" aria-hidden="true">`}</div>`;
}
export function visitRow(appointment, staff = false) {
  return `<div class="visit-row"><span class="icon-tile ${appointment.serviceId === 'grooming' ? 'peach' : 'lavender'}">${icon(appointment.serviceId)}</span><div class="visit-info"><strong>${e(appointment.serviceName)}</strong><span>${e(appointment.petName)}${staff ? ` · ${e(appointment.customerName)}` : ''}</span></div><div class="visit-date"><strong>${dateLabel(appointment.date)}</strong><span>${timeLabel(appointment.time)}</span></div>${statusBadge(appointment.status)}</div>`;
}
export function receipt(appointment) {
  const p = appointment.payment;
  return `<article class="receipt"><div class="receipt-brand brand">${brand()}</div><div class="receipt-heading"><span class="eyebrow">Petopia Pet Care Services · Tagum City</span><h2>Payment receipt</h2><p>Receipt #${e(p.id.slice(0, 8).toUpperCase())}</p></div><div class="receipt-meta"><div><small>Received from</small><strong>${e(appointment.customerName)}</strong><span>${e(appointment.petName)}</span></div><div><small>Payment recorded</small><strong>${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(p.recordedAt))}</strong><span>By ${e(p.recordedBy)}</span></div></div><div class="receipt-line"><div><strong>${e(appointment.serviceName)}</strong><small>${dateLabel(appointment.date)} · ${timeLabel(appointment.time)}</small></div><strong>${money(p.amount)}</strong></div><div class="receipt-total"><span>Total paid</span><strong>${money(p.amount)}</strong></div><div class="receipt-meta"><div><small>Method</small><strong>${e(p.method)}</strong></div><div><small>Reference</small><strong>${e(p.reference || '—')}</strong></div></div><p class="receipt-footer">Payment recorded · Thank you for trusting us with their care.</p></article>`;
}
