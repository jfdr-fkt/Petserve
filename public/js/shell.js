import { state, isStaff } from './state.js';
import { brand, icon, userAvatar } from './components.js';
import { escapeHTML as e, dateLabel, todayManila } from './utils.js';

import { navigation, navigationMarkup } from './navigation.js';
export { navigation };

export function notices() {
  const apps = state.data.appointments;
  const list = isStaff()
    ? apps
        .filter((a) => a.status === 'pending')
        .map((a) => ({
          title: `${a.petName} is waiting for review`,
          text: `${a.serviceName} · ${dateLabel(a.date)}`,
          view: 'appointments',
        }))
    : apps
        .filter((a) => a.status === 'confirmed')
        .map((a) => ({
          title: `${a.petName}’s visit is confirmed`,
          text: `${a.serviceName} · ${dateLabel(a.date)}`,
          view: 'appointments',
        }));
  for (const h of state.data.healthLogs.filter(
    (h) =>
      h.dueDate &&
      h.dueDate <=
        new Date(Date.parse(`${todayManila()}T12:00Z`) + 14 * 86400000).toISOString().slice(0, 10),
  )) {
    list.push({
      title: `${state.data.pets.find((p) => p.id === h.petId)?.name || 'Pet'} · care reminder`,
      text: `${h.title} · follow-up ${dateLabel(h.dueDate)}`,
      view: 'pets',
    });
  }
  for (const thread of state.data.chatThreads.filter((t) => t.unread))
    list.push({
      title: `${thread.unread} new message${thread.unread === 1 ? '' : 's'}`,
      text: isStaff() ? thread.customerName : 'From the Petopia care team',
      view: 'chat',
      unread: thread.unread,
    });
  return list;
}
export function shell(content) {
  const user = state.data.user,
    items = navigation(),
    updates = notices();
  return `<div class="app-shell ${state.sidebarCollapsed ? 'sidebar-collapsed' : ''} ${state.mobileMenuOpen ? 'mobile-menu-open' : ''}"><button type="button" class="sidebar-overlay" data-action="sidebar-close" aria-label="Close navigation"></button><aside class="sidebar" id="sidebar" ${window.innerWidth <= 720 && !state.mobileMenuOpen ? 'inert' : ''}><div class="sidebar-header"><a class="brand" href="#overview" data-view="overview" aria-label="PetServe overview">${brand()}</a><button type="button" class="icon-button sidebar-toggle" data-action="sidebar-toggle" aria-label="${state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}" aria-expanded="${!state.sidebarCollapsed}" aria-controls="sidebar">${icon(state.sidebarCollapsed ? 'expand' : 'collapse')}</button><button type="button" class="icon-button sidebar-mobile-close" data-action="sidebar-close" aria-label="Close navigation">${icon('close')}</button></div><div class="workspace-label">${user.role === 'customer' ? 'Your pet care' : user.role === 'admin' ? 'Clinic administration' : 'Clinic workspace'}</div><nav class="side-nav" aria-label="Main navigation">${navigationMarkup(updates)}</nav><div class="sidebar-bottom"><div class="profile-mini">${userAvatar(user)}<div><strong>${e(user.name)}</strong><small>${user.role === 'staff' ? 'Employee' : user.role === 'admin' ? 'Administrator' : 'Pet parent'}</small></div><button type="button" class="icon-button" data-action="logout" aria-label="Sign out" title="Sign out">${icon('logout')}</button></div></div></aside><div class="main-shell" ${state.mobileMenuOpen ? 'inert' : ''}><header class="topbar"><button type="button" class="icon-button mobile-menu-toggle" data-action="mobile-menu" aria-label="Open navigation" aria-expanded="${state.mobileMenuOpen}" aria-controls="sidebar">${icon('menu')}</button><div class="breadcrumb">Your workspace <span>/</span> <strong>${items.find((item) => item[0] === state.view)?.[2] || 'Overview'}</strong></div><div class="topbar-right"><span class="topbar-date">${icon('calendar')}${dateLabel(todayManila())}</span><div class="notification-wrap"><button type="button" class="icon-button notification-button" data-action="notifications" aria-label="Notifications${updates.length ? `, ${updates.length} updates` : ''}" aria-expanded="${state.notifications}">${icon('bell')}${updates.length ? '<span class="notification-dot"></span>' : ''}</button>${
    state.notifications
      ? `<div class="notification-panel"><h3>Care updates</h3>${
          updates.length
            ? updates
                .slice(0, 8)
                .map(
                  (n) =>
                    `<button type="button" data-view="${n.view}"><strong>${e(n.title)}</strong><small>${e(n.text)}</small></button>`,
                )
                .join('')
            : '<p>You’re all caught up.</p>'
        }</div>`
      : ''
  }</div><button type="button" class="user-avatar small" data-view="account" aria-label="My account">${user.photoUrl ? `<img src="${e(user.photoUrl)}" alt="">` : e(user.name[0])}</button><button type="button" class="icon-button mobile-signout" data-action="logout" aria-label="Sign out">${icon('logout')}</button></div></header><main id="main-content" tabindex="-1">${content}</main></div></div>`;
}
