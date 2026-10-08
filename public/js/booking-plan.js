import { state } from './state.js';
import { escapeHTML as e, timeLabel } from './utils.js';

export function normalizeBooking() {
  const b = state.booking,
    pets = state.data.pets,
    services = state.data.services.filter((service) => service.active);
  if (!services.some((service) => service.id === b.serviceId)) b.serviceId = services[0]?.id || '';
  b.petIds = (b.petIds || []).filter((id) => pets.some((pet) => pet.id === id));
  if (!b.bulk) {
    if (!b.petIds.length)
      b.petIds = [pets.find((pet) => pet.id === b.petId)?.id || pets[0]?.id].filter(Boolean);
    if (b.serviceId !== 'consultation') b.petIds = b.petIds.slice(0, 1);
  }
  b.petId = b.petIds[0] || '';
  b.serviceIds ||= [b.serviceId];
  b.serviceIds = b.serviceIds.filter((id) => services.some((service) => service.id === id));
  b.care ||= {};
  for (const id of b.petIds) {
    b.care[id] ||= [...b.serviceIds];
    b.care[id] = b.care[id].filter((serviceId) =>
      services.some((service) => service.id === serviceId),
    );
  }
  return b;
}
export function careItems() {
  return state.booking.petIds.map((petId) => ({
    petId,
    serviceIds: [...(state.booking.care?.[petId] || [])],
  }));
}
export function careSelectionError() {
  if (!state.booking.petIds.length) return 'Select at least one pet for this request.';
  const missing = careItems().find((item) => !item.serviceIds.length);
  return missing
    ? `Choose at least one service for ${state.data.pets.find((pet) => pet.id === missing.petId)?.name || 'each selected pet'}.`
    : '';
}
export function planPreview() {
  const planned = state.slots.find((slot) => slot.time === state.booking.time)?.appointments || [];
  return planned.length
    ? `<h3>Planned service times</h3><ol>${planned.map((item) => `<li><time>${timeLabel(item.time)}</time><div><strong>${e(item.petNames.join(', '))}</strong><span>${e(item.serviceName)}</span></div></li>`).join('')}</ol><p>The care team will review this plan. Each service keeps its own care and payment record.</p>`
    : '<p>Select an arrival time to preview the service plan for all selected pets.</p>';
}
