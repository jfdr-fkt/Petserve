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
  return `${heading(staff ? 'A little organization, a lot of care' : 'Their happy place starts here', `${staff ? 'Hello' : 'Welcome back'}, ${e(state.data.user.name.split(' ')[0])}.`, staff ? 'Keep the day flowing and every pet’s care connected.' : 'A little overview of your pets and everything coming up.', viewButton(staff ? 'View schedule' : 'Book a visit', staff ? 'schedule' : 'book', staff ? 'calendar' : 'plus'))}
  <section class="welcome-banner"><div><span class="eyebrow">${staff ? 'ONE TEAM. THOUGHTFUL CARE.' : 'GOOD CARE, ONE VISIT AT A TIME.'}</span><h2>${staff ? 'Every visit deserves<br>a little extra care.' : 'Big love for<br>your little companions.'}</h2><p>${staff ? `${pending.length} request${pending.length === 1 ? '' : 's'} waiting for your review. Let’s make their next visit a good one.` : 'From fresh trims to wellness visits, we’re here for the moments that keep them happy.'}</p>${viewButton(staff ? 'Review requests' : 'Meet your pets', staff ? 'appointments' : 'pets', 'arrow', 'soft')}</div><div class="welcome-art"><span class="art-sparkle sparkle-one">✦</span><img src="/assets/dog.svg" alt="" class="welcome-dog"><img src="/assets/cat.svg" alt="" class="welcome-cat"><span class="art-sparkle sparkle-two">✧</span><span class="art-caption">a little love, every day ♡</span></div></section>
  ${stats(
    staff
      ? [
          [
            'Today’s visits',
            apps.filter((a) => a.date === today && a.status === 'confirmed').length,
            'calendar',
            'sage',
            'Confirmed appointments',
          ],
          ['Awaiting review', pending.length, 'queue', 'peach', 'New appointment requests'],
          ['Pet profiles', state.data.pets.length, 'pets', 'lavender', 'Care records connected'],
          ['Collections', money(paid), 'card', 'sand', 'Recorded payments'],
        ]
      : [
          ['My companions', state.data.pets.length, 'pets', 'sage', 'A little family of your own'],
          ['Upcoming visits', upcoming.length, 'calendar', 'peach', 'Something to look forward to'],
          [
            'Completed visits',
            apps.filter((a) => a.status === 'completed').length,
            'check',
            'lavender',
            'Care milestones together',
          ],
          ['Awaiting review', pending.length, 'clock', 'sand', 'We’ll confirm your request'],
        ],
  )}
  <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>${staff ? 'Next on the schedule' : 'Your upcoming visits'}</h2><p>A little heads-up for what’s next.</p></div><button type="button" class="text-button" data-view="appointments">View all ${icon('arrow')}</button></div>${
    upcoming.length
      ? upcoming
          .slice(0, 4)
          .map((a) => visitRow(a, staff))
          .join('')
      : empty(
          'A little room in the calendar',
          staff
            ? 'New appointment requests will appear here.'
            : 'Ready for their next visit? Find a time that suits you.',
          staff ? '' : viewButton('Plan a visit', 'book', 'plus', 'soft'),
          'calendar',
        )
  }</section><section class="panel"><div class="panel-header"><div><h2>${staff ? 'Care reminders' : 'Your little family'}</h2><p>${staff ? 'Follow-ups recorded by owners and the clinic.' : 'The faces behind your favorite moments.'}</p></div>${!staff ? '<button type="button" class="text-button" data-view="pets">View pets</button>' : ''}</div>${
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
            'All quiet here',
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
            'Meet your first companion',
            'Add a pet profile to keep their care together.',
            viewButton('Add a pet', 'pets', 'plus', 'soft'),
          )
  }</section></div>
  ${
    !staff
      ? `<section class="services-strip"><div><span class="eyebrow">A LITTLE SOMETHING FOR EVERY PET</span><h2>Care that feels like home.</h2></div><div class="service-mini-grid">${state.data.services
          .filter((s) => s.active)
          .map(
            (s) =>
              `<button type="button" class="service-mini" data-action="book-service" data-id="${s.id}"><span class="icon-tile ${s.id === 'grooming' ? 'peach' : 'lavender'}">${icon(s.id)}</span><strong>${e(s.name)}</strong><small>${s.duration} min · from ${money(s.basePrice)}</small>${icon('arrow')}</button>`,
          )
          .join('')}</div></section>`
      : ''
  }`;
}
