import { state } from '../state.js';
import { heading, icon, petAvatar, field, viewButton, empty } from '../components.js';
import { escapeHTML as e, money, dateLabel, timeLabel, todayManila } from '../utils.js';

export function dateOptions() {
  const result = [],
    today = todayManila();
  for (let i = 0; i < 30 && result.length < 8; i++) {
    const date = new Date(Date.parse(`${today}T12:00Z`) + i * 86400000);
    if (state.data.schedule.weekdays.includes(date.getUTCDay()))
      result.push(date.toISOString().slice(0, 10));
  }
  return result;
}
export function slotPicker() {
  return state.slotsLoading
    ? '<p class="slots-message">Checking available times…</p>'
    : state.slotError
      ? `<p class="slots-message danger-text">${e(state.slotError)}</p>`
      : !state.slots.length
        ? '<p class="slots-message">Choose a date to see available times.</p>'
        : `<div class="time-grid">${state.slots.map((s) => `<button type="button" data-time="${s.time}" class="time-option ${state.booking.time === s.time ? 'selected' : ''}" ${s.available ? '' : 'disabled'} aria-pressed="${state.booking.time === s.time}" title="${e(s.reason || 'Available')}">${timeLabel(s.time)}${!s.available ? '<small>Unavailable</small>' : ''}</button>`).join('')}</div>${state.slots.every((s) => !s.available) ? '<p class="slots-message">No times available on this day. Choose another date.</p>' : ''}`;
}
export function booking() {
  if (!state.data.pets.length)
    return `${heading('A little planning goes a long way', 'Book a visit', 'Let’s make their next visit a happy one.')}<section class="panel">${empty('First, meet your companion', 'Add a pet profile so the care team knows who’s coming.', viewButton('Add a pet', 'pets', 'plus'))}</section>`;
  const services = state.data.services.filter((s) => s.active),
    b = state.booking;
  if (!services.length)
    return `${heading('Thoughtful care', 'Book a visit', 'Choose the right care for your companion.')}<section class="panel">${empty('Bookings are currently paused', 'Check back soon for available services.', '', 'calendar')}</section>`;
  if (!services.some((s) => s.id === b.serviceId)) b.serviceId = services[0].id;
  if (!state.data.pets.some((p) => p.id === b.petId)) b.petId = state.data.pets[0].id;
  b.petIds = (b.petIds || []).filter((id) => state.data.pets.some((p) => p.id === id));
  if (!b.petIds.length) b.petIds = [b.petId];
  if (b.serviceId !== 'consultation') b.petIds = [b.petIds[0]];
  b.petId = b.petIds[0];
  const service = services.find((s) => s.id === b.serviceId),
    selectedPets = state.data.pets.filter((p) => b.petIds.includes(p.id));
  const dates = dateOptions(),
    max = new Date(Date.parse(`${todayManila()}T12:00Z`) + 90 * 86400000)
      .toISOString()
      .slice(0, 10);
  return `${heading('A little planning goes a long way', 'Book a visit', 'Choose their care, find a time, and we’ll take it from there.')}<div class="booking-layout"><form data-form="booking" class="booking-form"><section class="panel booking-section"><div class="step-title"><span>01</span><div><h2>What kind of care?</h2><p>A fresh start or a little peace of mind.</p></div></div><div class="service-options">${services.map((s) => `<button type="button" data-service="${s.id}" class="service-option ${b.serviceId === s.id ? 'selected' : ''}" aria-pressed="${b.serviceId === s.id}"><span class="icon-tile ${s.id === 'grooming' ? 'peach' : 'lavender'}">${icon(s.id)}</span><strong>${e(s.name)}</strong><p>${e(s.description)}</p><div><small>${s.id === 'consultation' ? 'Per pet' : 'Service price'}</small><strong>${money(s.basePrice)}</strong></div></button>`).join('')}</div></section><section class="panel booking-section"><div class="step-title"><span>02</span><div><h2>Who’s coming along?</h2><p>${b.serviceId === 'consultation' ? 'Select up to six pets for one shared consultation. The consultation price applies per pet.' : 'Choose the companion for this visit.'}</p></div></div><div class="pet-options">${state.data.pets.map((p) => `<button type="button" data-book-pet="${p.id}" class="pet-option ${b.petIds.includes(p.id) ? 'selected' : ''}" aria-pressed="${b.petIds.includes(p.id)}">${petAvatar(p, 'sm')}<div><strong>${e(p.name)}</strong><small>${e(p.breed || p.species)}</small></div>${b.petIds.includes(p.id) ? icon('check') : ''}</button>`).join('')}</div></section><section class="panel booking-section"><div class="step-title"><span>03</span><div><h2>A time that suits you</h2><p>All visit times are in Asia/Manila.</p></div></div><div class="date-grid">${dates.map((d) => `<button type="button" data-date="${d}" class="date-option ${b.date === d ? 'selected' : ''}" aria-pressed="${b.date === d}"><small>${new Date(`${d}T12:00Z`).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'UTC' })}</small><strong>${Number(d.slice(8))}</strong><span>${new Date(`${d}T12:00Z`).toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' })}</span></button>`).join('')}</div>${field('Or choose another date', 'date', b.date, { type: 'date', id: 'booking-date', attrs: `min="${todayManila()}" max="${max}"` })}<div class="field"><label>Available times</label><div id="slot-picker">${slotPicker()}</div></div></section><section class="panel booking-section"><div class="step-title"><span>04</span><div><h2>Anything we should know?</h2><p>A small note can make a big difference.</p></div></div>${field('Visit note (optional)', 'note', b.note, { type: 'textarea', attrs: 'maxlength="300"', placeholder: 'Special requests, behavior, or anything to help them feel comfortable.' })}<div class="form-error" role="alert" hidden></div><button type="submit" class="btn btn-primary btn-block" ${!b.time ? 'disabled' : ''}>Send appointment request ${icon('arrow')}</button><p class="form-footnote">Your visit is reserved once the care team confirms your request.</p></section></form><aside class="booking-summary panel"><span class="eyebrow">A LITTLE LOOK AHEAD</span><h2>Your visit, at a glance.</h2><div class="group-summary">${selectedPets.map((p) => `<span>${petAvatar(p, 'sm')}<strong>${e(p.name)}</strong></span>`).join('')}</div><dl><div><dt>Care</dt><dd>${e(service.name)}</dd></div><div><dt>Pets</dt><dd>${selectedPets.length}</dd></div><div><dt>Date</dt><dd>${b.date ? dateLabel(b.date) : 'Choose a date'}</dd></div><div><dt>Time</dt><dd>${b.time ? timeLabel(b.time) : 'Choose a time'}</dd></div></dl><div class="summary-total"><small>Estimated service price</small><strong>${money(service.basePrice * selectedPets.length)}</strong></div><p class="summary-note">Final charges are confirmed by the care team. After the visit, you can pay at the clinic or submit an online wallet transfer for verification.</p><div class="location-note">${icon('calendar')}<div><strong>Petopia Pet Care Services</strong><small>Timog Avenue, Tagum City</small></div></div></aside></div>`;
}
