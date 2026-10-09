import { state, isStaff } from '../state.js';
import {
  heading,
  stats,
  icon,
  viewButton,
  petAvatar,
  statusBadge,
  visitRow,
  empty,
} from '../components.js';
import { escapeHTML as e, money, dateLabel, todayManila } from '../utils.js';

export function overview() {
  const staff = isStaff(),
    apps = state.data.appointments,
    today = todayManila();
  const pending = apps.filter((a) => a.status === 'pending');
  const upcoming = apps
    .filter((a) => ['pending', 'confirmed'].includes(a.status) && a.date >= today)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const paid = apps.reduce((sum, a) => sum + (a.payment?.amount || 0), 0);
  const followups = state.data.healthLogs
    .filter((h) => h.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return `${heading(`${staff ? 'Hello' : 'Welcome back'}, ${e(state.data.user.name.split(' ')[0])}.`, viewButton(staff ? 'View schedule' : 'Book a visit', staff ? 'schedule' : 'book', staff ? 'calendar' : 'plus'))}
  <section class="welcome-banner"><div><h2>${staff ? 'Today’s appointments' : 'Pet care'}</h2>${viewButton(staff ? 'Review requests' : 'Meet your pets', staff ? 'appointments' : 'pets', 'arrow', 'soft')}</div><div class="welcome-art"><span class="art-sparkle sparkle-one">✦</span><img src="/assets/dog.svg" alt="" class="welcome-dog"><img src="/assets/cat.svg" alt="" class="welcome-cat"><span class="art-sparkle sparkle-two">✧</span></div></section>
  ${stats(
    staff
      ? [
          [
            'Today’s visits',
            apps.filter((a) => a.date === today && a.status === 'confirmed').length,
            'calendar',
            'sage',
          ],
          ['Awaiting review', pending.length, 'queue', 'peach'],
          ['Pet profiles', state.data.pets.length, 'pets', 'lavender'],
          ['Collections', money(paid), 'card', 'sand'],
        ]
      : [
          ['My pets', state.data.pets.length, 'pets', 'sage'],
          ['Upcoming visits', upcoming.length, 'calendar', 'peach'],
          [
            'Completed visits',
            apps.filter((a) => a.status === 'completed').length,
            'check',
            'lavender',
          ],
          ['Awaiting review', pending.length, 'clock', 'sand'],
        ],
  )}
  <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>${staff ? 'Next on the schedule' : 'Your upcoming visits'}</h2></div><button type="button" class="text-button" data-view="appointments">View all ${icon('arrow')}</button></div>${
    upcoming.length
      ? upcoming
          .slice(0, 4)
          .map((a) => visitRow(a, staff))
          .join('')
      : empty(
          'No upcoming visits',
          staff
            ? 'New appointment requests will appear here.'
            : 'Ready for their next visit? Find a time that suits you.',
          staff ? '' : viewButton('Plan a visit', 'book', 'plus', 'soft'),
          'calendar',
        )
  }</section><section class="panel"><div class="panel-header"><div><h2>${staff ? 'Care reminders' : 'My pets'}</h2></div>${!staff ? '<button type="button" class="text-button" data-view="pets">View pets</button>' : ''}</div>${
    staff
      ? followups.length
        ? followups
            .slice(0, 4)
            .map(
              (h) =>
                `<div class="reminder-row"><span class="icon-tile lavender">${icon('vaccination')}</span><div><strong>${e(state.data.pets.find((p) => p.id === h.petId)?.name || 'Pet')} · ${e(h.title)}</strong><small>${h.dueDate < today ? 'Follow-up date passed' : 'Follow-up'} · ${dateLabel(h.dueDate)}</small></div></div>`,
            )
            .join('')
        : empty(
            'No care reminders',
            'Add follow-up dates to health records to see reminders.',
            '',
            'vaccination',
          )
      : state.data.pets.length
        ? state.data.pets
            .slice(0, 3)
            .map(
              (p) =>
                `<button type="button" class="family-row" data-action="pet-select" data-id="${p.id}">${petAvatar(p, 'sm')}<div><strong>${e(p.name)}</strong><small>${e(p.breed || p.species)} · ${e(p.age || 'Your companion')}</small></div>${icon('arrow')}</button>`,
            )
            .join('')
        : empty(
            'No pets added',
            'Add a pet profile to keep their care together.',
            viewButton('Add a pet', 'pets', 'plus', 'soft'),
          )
  }</section></div>
  ${
    !staff
      ? `<section class="services-strip"><div><h2>Services</h2></div><div class="service-mini-grid">${state.data.services
          .filter((s) => s.active)
          .map(
            (s) =>
              `<button type="button" class="service-mini" data-action="book-service" data-id="${s.id}"><span class="icon-tile ${s.id === 'grooming' ? 'peach' : 'lavender'}">${icon(s.id)}</span><strong>${e(s.name)}</strong><small>From ${money(s.basePrice)}</small>${icon('arrow')}</button>`,
          )
          .join('')}</div></section>`
      : ''
  }`;
}
