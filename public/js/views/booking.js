import { state } from '../state.js';
import { heading, icon, petAvatar, field, viewButton, empty } from '../components.js';
import { escapeHTML as e, money, dateLabel, timeLabel, todayManila } from '../utils.js';
import { normalizeBooking, careItems, planPreview, careSelectionError } from '../booking-plan.js';

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
        : `<div class="time-grid">${state.slots.map((s) => `<button type="button" data-time="${s.time}" class="time-option ${state.booking.time === s.time ? 'selected' : ''}" ${s.available ? '' : 'disabled'} aria-pressed="${state.booking.time === s.time}" title="${e(s.reason || 'Available')}">${timeLabel(s.time)}${!s.available ? '<small>Unavailable</small>' : ''}</button>`).join('')}</div>${state.slots.every((s) => !s.available) ? '<p class="slots-message">The selected care cannot fit on this day. Try another date or adjust the selections.</p>' : ''}`;
}
const mark = (checked, partial = false) =>
  `<span class="selection-check ${checked ? 'checked' : partial ? 'partial' : ''}" aria-hidden="true">${checked ? icon('check') : partial ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 12h12"/></svg>' : ''}</span>`;
function serviceChoices(services, b) {
  return `<section class="panel booking-section"><div class="step-title"><span>01</span><div><h2>${b.bulk ? 'Care for all selected pets' : 'What kind of care?'}</h2><p>${b.bulk ? 'Select one or more services to apply to every selected pet. You can adjust each pet below.' : 'A fresh start or a little peace of mind.'}</p></div></div><div class="service-options">${services
    .map((service) => {
      const assigned = b.petIds.filter((id) => (b.care[id] || []).includes(service.id)).length;
      const selected = b.bulk
        ? b.petIds.length
          ? assigned === b.petIds.length
          : b.serviceIds.includes(service.id)
        : b.serviceId === service.id;
      const partial = b.bulk && assigned > 0 && !selected;
      return `<button type="button" data-service="${service.id}" class="service-option ${selected ? 'selected' : partial ? 'partial' : ''}" aria-pressed="${partial ? 'mixed' : selected}"><span class="icon-tile ${service.id === 'grooming' ? 'peach' : 'lavender'}">${icon(service.id)}</span>${mark(selected, partial)}<strong>${e(service.name)}</strong><p>${e(service.description)}</p><div><small>${partial ? `${assigned} of ${b.petIds.length} pets` : 'Per pet'}</small><strong>${money(service.basePrice)}</strong></div></button>`;
    })
    .join('')}</div></section>`;
}
function petChoices(pets, services, b) {
  const selectable = pets.slice(0, 30);
  const allSelected = selectable.every((pet) => b.petIds.includes(pet.id));
  const text = b.bulk
    ? 'Check any pets, then choose the care each one needs.'
    : b.serviceId === 'consultation'
      ? 'Select up to six pets for one shared consultation. The consultation price applies per pet.'
      : 'Choose the companion for this visit.';
  return `<section class="panel booking-section"><div class="step-title"><span>02</span><div><h2>Who’s coming along?</h2><p>${text}</p></div></div><div class="booking-selection-tools"><label class="check-option"><input type="checkbox" id="booking-multiple" ${b.bulk ? 'checked' : ''}><span>Book multiple pets & services</span></label>${b.bulk ? `<label class="check-option"><input type="checkbox" id="booking-all-pets" ${allSelected ? 'checked' : ''}><span>${pets.length > 30 ? 'Select the first 30 pets' : `Select all ${pets.length} pets`}</span></label>` : ''}</div><div class="pet-options ${b.bulk ? 'pet-care-options' : ''}">${pets
    .map((pet) => {
      const selected = b.petIds.includes(pet.id);
      const control = `<button type="button" data-book-pet="${pet.id}" class="pet-option ${selected ? 'selected' : ''}" aria-pressed="${selected}">${petAvatar(pet, 'sm')}<div><strong>${e(pet.name)}</strong><small>${e(pet.breed || pet.species)}</small></div>${mark(selected)}</button>`;
      if (!b.bulk) return control;
      return `<div class="pet-care-card ${selected ? 'selected' : ''}">${control}${selected ? `<fieldset class="pet-care-services"><legend class="sr-only">Services for ${e(pet.name)}</legend>${services.map((service) => `<label class="check-option"><input type="checkbox" id="care-${pet.id}-${service.id}" data-care-pet="${pet.id}" data-care-service="${service.id}" ${(b.care[pet.id] || []).includes(service.id) ? 'checked' : ''}><span><strong>${e(service.name)}</strong><small>${money(service.basePrice)}</small></span></label>`).join('')}</fieldset>` : ''}</div>`;
    })
    .join(
      '',
    )}</div>${b.bulk && careSelectionError() ? `<p class="care-selection-hint">${e(careSelectionError())}</p>` : ''}</section>`;
}
function summary(services, selectedPets, b) {
  const service = services.find((entry) => entry.id === b.serviceId);
  const items = b.bulk
    ? careItems()
    : b.petIds.map((petId) => ({ petId, serviceIds: [b.serviceId] }));
  const total = items.reduce(
    (sum, item) =>
      sum +
      item.serviceIds.reduce(
        (price, id) => price + (services.find((entry) => entry.id === id)?.basePrice || 0),
        0,
      ),
    0,
  );
  return `<aside class="booking-summary panel"><span class="eyebrow">A LITTLE LOOK AHEAD</span><h2>Your visit, at a glance.</h2><div class="group-summary">${selectedPets.map((pet) => `<span>${petAvatar(pet, 'sm')}<div><strong>${e(pet.name)}</strong>${b.bulk ? `<small>${(b.care[pet.id] || []).map((id) => e(services.find((entry) => entry.id === id)?.name || '')).join(' · ') || 'Choose care'}</small>` : ''}</div></span>`).join('')}</div><dl><div><dt>${b.bulk ? 'Care choices' : 'Care'}</dt><dd>${b.bulk ? items.reduce((count, item) => count + item.serviceIds.length, 0) : e(service.name)}</dd></div><div><dt>Pets</dt><dd>${selectedPets.length}</dd></div><div><dt>Date</dt><dd>${b.date ? dateLabel(b.date) : 'Choose a date'}</dd></div><div><dt>${b.bulk ? 'Arrival' : 'Time'}</dt><dd>${b.time ? timeLabel(b.time) : 'Choose a time'}</dd></div></dl><div class="summary-total"><small>Estimated service price</small><strong>${money(total)}</strong></div>${b.bulk ? `<div id="care-plan-preview" class="care-plan-preview">${planPreview()}</div>` : ''}<p class="summary-note">Final charges are confirmed by the care team. After the visit, you can pay at the clinic or submit an online wallet transfer for verification.</p><div class="location-note">${icon('calendar')}<div><strong>Petopia Pet Care Services</strong><small>Timog Avenue, Tagum City</small></div></div></aside>`;
}
export function booking() {
  if (!state.data.pets.length)
    return `${heading('A little planning goes a long way', 'Book a visit', 'Let’s make their next visit a happy one.')}<section class="panel">${empty('First, meet your companion', 'Add a pet profile so the care team knows who’s coming.', viewButton('Add a pet', 'pets', 'plus'))}</section>`;
  const services = state.data.services.filter((service) => service.active);
  if (!services.length)
    return `${heading('Thoughtful care', 'Book a visit', 'Choose the right care for your companion.')}<section class="panel">${empty('Bookings are currently paused', 'Check back soon for available services.', '', 'calendar')}</section>`;
  const b = normalizeBooking(),
    selectedPets = state.data.pets.filter((pet) => b.petIds.includes(pet.id));
  const dates = dateOptions(),
    max = new Date(Date.parse(`${todayManila()}T12:00Z`) + 90 * 86400000)
      .toISOString()
      .slice(0, 10);
  return `${heading('A little planning goes a long way', 'Book a visit', 'Choose their care, find a time, and we’ll take it from there.')}<div class="booking-layout"><form data-form="booking" class="booking-form">${serviceChoices(services, b)}${petChoices(state.data.pets, services, b)}<section class="panel booking-section"><div class="step-title"><span>03</span><div><h2>A time that suits you</h2><p>${b.bulk ? 'Choose an arrival time. Services are arranged around pet and care-team availability.' : 'All visit times are in Asia/Manila.'}</p></div></div><div class="date-grid">${dates.map((date) => `<button type="button" data-date="${date}" class="date-option ${b.date === date ? 'selected' : ''}" aria-pressed="${b.date === date}"><small>${new Date(`${date}T12:00Z`).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'UTC' })}</small><strong>${Number(date.slice(8))}</strong><span>${new Date(`${date}T12:00Z`).toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' })}</span></button>`).join('')}</div>${field('Or choose another date', 'date', b.date, { type: 'date', id: 'booking-date', attrs: `min="${todayManila()}" max="${max}"` })}<div class="field"><label>Available ${b.bulk ? 'arrival ' : ''}times</label><div id="slot-picker">${slotPicker()}</div></div></section><section class="panel booking-section"><div class="step-title"><span>04</span><div><h2>Anything we should know?</h2><p>A small note can make a big difference.</p></div></div>${field('Visit note (optional)', 'note', b.note, { type: 'textarea', attrs: 'maxlength="300"', placeholder: 'Special requests, behavior, or anything to help them feel comfortable.' })}<div class="form-error" role="alert" hidden></div><button type="submit" class="btn btn-primary btn-block" ${!b.time ? 'disabled' : ''}>Send ${b.bulk ? 'care' : 'appointment'} request ${icon('arrow')}</button><p class="form-footnote">${b.bulk ? 'One request, with separate service records for every pet. The care team confirms the plan before it is reserved.' : 'Your visit is reserved once the care team confirms your request.'}</p></section></form>${summary(services, selectedPets, b)}</div>`;
}
