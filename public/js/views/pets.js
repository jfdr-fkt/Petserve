import { state, isStaff } from '../state.js';
import {
  heading,
  button,
  icon,
  petAvatar,
  statusBadge,
  visitRow,
  empty,
  viewButton,
} from '../components.js';
import { escapeHTML as e, dateLabel, todayManila } from '../utils.js';
import { petMediaContent } from '../pet-media.js';

export function pets() {
  const staff = isStaff();
  const list = state.data.pets.filter(
    (p) =>
      (state.petSpecies === 'all' || p.species === state.petSpecies) &&
      `${p.name} ${p.breed} ${p.ownerName}`.toLowerCase().includes(state.search.toLowerCase()),
  );
  if (!state.selectedPet || !list.some((p) => p.id === state.selectedPet))
    state.selectedPet = list[0]?.id || '';
  const pet = list.find((p) => p.id === state.selectedPet);
  return `${heading(staff ? 'Pet records' : 'My pets', !staff ? button('Add a pet', 'pet-add', 'plus') : '')}<div class="pets-toolbar"><label class="search-field">${icon('search')}<input type="search" name="search" aria-label="Search pets" placeholder="${staff ? 'Search pets, breeds or owners…' : 'Search pets…'}" value="${e(state.search)}"></label><div class="tabs">${[
    ['all', 'All pets'],
    ['Dog', 'Dogs'],
    ['Cat', 'Cats'],
    ['Other', 'Other'],
  ]
    .map(
      ([key, label]) =>
        `<button type="button" data-species="${key}" class="${state.petSpecies === key ? 'active' : ''}">${label}</button>`,
    )
    .join(
      '',
    )}</div><span class="muted small-text">${list.length} companion${list.length === 1 ? '' : 's'}</span></div>${
    list.length
      ? `<div class="pets-workspace"><aside class="pet-list" aria-label="Pet profiles">${list.map((p) => `<button type="button" class="pet-list-card ${p.id === pet.id ? 'selected' : ''}" data-action="pet-select" data-id="${p.id}" aria-pressed="${p.id === pet.id}">${petAvatar(p)}<div><strong>${e(p.name)}</strong><small>${e(p.breed || p.species)}</small><span>${staff ? e(p.ownerName) : e(p.species)}</span></div>${icon('arrow')}</button>`).join('')}${!staff ? `<button type="button" class="add-pet-card" data-action="pet-add">${icon('plus')}<span>Add a pet</span></button>` : ''}</aside><section class="pet-detail"><div class="pet-cover"><span class="pet-cover-label">${staff ? 'Pet record' : 'Pet profile'}</span><span class="pet-cover-paw">${icon('brand')}</span></div><div class="pet-profile-heading">${petAvatar(pet, 'xl')}<div class="pet-identity"><span class="eyebrow">${e(pet.species)}${pet.sex ? ` · ${e(pet.sex)}` : ''}</span><h2>${e(pet.name)}</h2><p>${e(pet.breed || 'One of a kind')}${pet.age ? ` · ${e(pet.age)}` : ''}${staff ? ` · ${e(pet.ownerName)}` : ''}</p></div><div class="actions">${button('Edit profile', 'pet-edit', 'edit', 'outline', `data-id="${pet.id}"`)}${!staff ? button('Book a visit', 'book-pet', 'calendar', 'primary', `data-id="${pet.id}"`) : ''}</div></div><div class="pet-tabs tabs" aria-label="Pet details">${[
          ['profile', 'About'],
          ['media', 'Photos & videos'],
          ['health', 'Health records'],
          ['history', 'Visit history'],
        ]
          .map(
            ([key, label]) =>
              `<button type="button" data-pet-tab="${key}" class="${state.petTab === key ? 'active' : ''}">${label}${key === 'health' ? `<span>${state.data.healthLogs.filter((h) => h.petId === pet.id).length}</span>` : key === 'media' ? `<span>${state.data.petMedia.filter((item) => item.petId === pet.id).length}</span>` : ''}</button>`,
          )
          .join('')}</div><div class="pet-tab-content">${petContent(pet)}</div></section></div>`
      : `<section class="panel">${empty(state.search || state.petSpecies !== 'all' ? 'No companions found' : 'No pets added', state.search ? 'Try another name or clear the filters.' : 'Add their name, a favorite photo, and a few details. We’ll keep the rest together.', !staff && !state.search ? button('Add your first pet', 'pet-add', 'plus') : '')}</section>`
  }`;
}

function petContent(pet) {
  if (state.petTab === 'media') return petMediaContent(pet);
  const apps = state.data.appointments.filter((a) => (a.petIds || [a.petId]).includes(pet.id));
  const logs = state.data.healthLogs
    .filter((h) => h.petId === pet.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (state.petTab === 'health')
    return `<div class="section-header"><div><h3>Health records</h3></div>${button('Add record', 'health-add', 'plus', 'soft', `data-id="${pet.id}"`)}</div>${logs.length ? `<div class="timeline">${logs.map((h) => `<article class="timeline-item"><span class="timeline-icon icon-tile ${h.type === 'vaccine' ? 'sage' : 'lavender'}">${icon(h.type === 'vaccine' ? 'vaccination' : h.type === 'deworming' ? 'deworming' : 'consultation')}</span><div><div class="timeline-top"><h4>${e(h.title)}</h4><span class="muted small-text">${dateLabel(h.date)}</span></div><small class="record-source">${e(h.source || 'Clinic record')} · ${h.type === 'vaccine' ? 'Vaccination' : h.type === 'medical' ? 'Health note' : 'Deworming'}</small>${h.notes ? `<p>${e(h.notes)}</p>` : ''}${h.dueDate ? `<span class="due-badge ${h.dueDate < todayManila() ? 'overdue' : ''}">${icon('calendar')}Follow-up · ${dateLabel(h.dueDate)}</span>` : ''}</div></article>`).join('')}</div>` : empty('No health records', 'Add earlier vaccinations, wellness visits, or a care note.', '', 'vaccination')}`;
  if (state.petTab === 'history')
    return `<div class="section-header"><div><h3>Visit history</h3></div></div>${apps.length ? apps.map((a) => `<article class="history-visit">${visitRow(a, isStaff())}${a.serviceRecord ? `<div class="service-record"><span class="record-source">Completed service record</span><p>${e(a.serviceRecord.notes || 'The service was completed by the clinic team.')}</p></div>` : a.staffNote ? `<p class="history-note">${e(a.staffNote)}</p>` : ''}${a.payment ? `<button type="button" class="text-button" data-action="receipt" data-id="${a.id}">View payment receipt ${icon('arrow')}</button>` : ''}</article>`).join('') : empty('No visit history', 'Completed visits and service notes will appear here.', isStaff() ? '' : button('Plan a visit', 'book-pet', 'calendar', 'soft', `data-id="${pet.id}"`), 'calendar')}`;
  const upcoming = apps
    .filter((a) => ['pending', 'confirmed'].includes(a.status))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0];
  const followup = logs
    .filter((h) => h.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return `<div class="pet-facts"><div><small>Species</small><strong>${e(pet.species)}</strong></div><div><small>Age / birthday</small><strong>${pet.birthDate ? dateLabel(pet.birthDate) : e(pet.age || 'Not added yet')}</strong></div><div><small>Weight</small><strong>${pet.weight ? `${e(pet.weight)} kg` : 'Not added yet'}</strong></div><div><small>Completed visits</small><strong>${apps.filter((a) => a.status === 'completed').length}</strong></div></div><div class="pet-notes-grid"><section class="care-note sage"><span class="icon-tile sage">${icon('pets')}</span><h3>Care notes</h3><p>${e(pet.notes || 'No care notes added.')}</p></section><section class="care-note peach"><span class="icon-tile peach">${icon('shield')}</span><h3>Allergies & sensitivities</h3><p>${e(pet.allergies || 'None recorded.')}</p></section></div><div class="section-header"><h3>Next visit</h3></div>${upcoming ? visitRow(upcoming, isStaff()) : `<div class="next-visit-empty">${icon('calendar')}<div><strong>No upcoming visit</strong></div>${!isStaff() ? button('Book a visit', 'book-pet', 'arrow', 'soft', `data-id="${pet.id}"`) : ''}</div>`}${followup ? `<div class="followup-note">${icon('vaccination')}<span>${e(followup.title)} · follow-up ${dateLabel(followup.dueDate)}</span></div>` : ''}${!isStaff() ? `<div class="pet-archive"><small>Archiving keeps appointment and payment history.</small><button type="button" class="text-button danger-text" data-action="pet-archive" data-id="${pet.id}">Archive profile</button></div>` : ''}`;
}
