import { state, isStaff } from './state.js';
import { icon } from './components.js';
import { escapeHTML as e } from './utils.js';

export function navigationGroups() {
  if (!isStaff())
    return [
      [
        'Visits & pet care',
        [
          ['book', 'book', 'Book a visit'],
          ['appointments', 'queue', 'My appointments'],
          ['pets', 'pets', 'My pets'],
          ['overview', 'overview', 'Overview'],
        ],
      ],
      [
        'Payments & help',
        [
          ['payments', 'card', 'Payments & receipts'],
          ['chat', 'chat', 'Chat with Petopia'],
        ],
      ],
      [
        'Community',
        [
          ['gallery', 'camera', 'Petopia gallery'],
          ['feedback', 'feedback', 'My feedback'],
        ],
      ],
      ['Your account', [['account', 'settings', 'My account']]],
    ];
  const admin = state.data.user.role === 'admin';
  return [
    [
      'Daily care',
      [
        ['appointments', 'queue', 'Appointments'],
        ['schedule', 'calendar', 'Schedule'],
        ['chat', 'chat', 'Customer messages'],
        ['pets', 'pets', 'Pet records'],
      ],
    ],
    [
      'Clinic tools',
      [
        ['payments', 'card', 'Payments'],
        ['services', 'grooming', 'Services'],
        ['overview', 'overview', 'Overview'],
        ['reports', 'reports', 'Reports'],
      ],
    ],
    [
      'Community',
      [
        ['gallery', 'camera', 'Petopia gallery'],
        ['feedback', 'feedback', 'Customer feedback'],
      ],
    ],
    [
      admin ? 'Administration' : 'Your account',
      [
        ...(admin ? [['accounts', 'shield', 'Accounts']] : []),
        ['account', 'settings', 'My account'],
      ],
    ],
  ];
}
export function navigation() {
  return navigationGroups().flatMap(([, entries]) => entries);
}
export function navigationMarkup(updates) {
  const pending = state.data.appointments.filter(
    (appointment) => appointment.status === 'pending',
  ).length;
  const unread = updates
    .filter((notice) => notice.view === 'chat')
    .reduce((sum, notice) => sum + notice.unread, 0);
  return navigationGroups()
    .map(
      ([label, entries]) =>
        `<section class="nav-group" aria-label="${e(label)}"><h2 class="nav-group-label">${e(label)}</h2>${entries.map(([view, glyph, name]) => `<button type="button" data-view="${view}" title="${e(name)}" aria-label="${e(name)}" class="${state.view === view ? 'active' : ''}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${e(name)}</span>${view === 'chat' ? `<small class="nav-count chat-nav-count">${unread || ''}</small>` : ''}${view === 'appointments' && isStaff() && pending ? `<small class="nav-count">${pending}</small>` : ''}</button>`).join('')}</section>`,
    )
    .join('');
}
