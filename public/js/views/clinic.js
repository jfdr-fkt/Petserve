import { appearance } from '../themes.js';
import { state } from '../state.js';
import { heading, field, icon, button, stats, statusBadge, empty } from '../components.js';
import { escapeHTML as e, dateLabel, todayManila, timeLabel, money } from '../utils.js';

export function schedule() {
  const date = state.scheduleDate || todayManila(),
    apps = state.data.appointments.filter(
      (a) => a.date === date && ['confirmed', 'pending', 'completed'].includes(a.status),
    );
  return `${heading('A calmer calendar for the whole team', 'Schedule', 'One place for daily visits, care teams, and available times.', button('Manage availability', 'availability', 'settings', 'outline'))}<section class="panel schedule-panel"><div class="panel-header"><div><h2>${dateLabel(date)}</h2><p>${apps.filter((a) => a.status === 'confirmed').length} confirmed · ${apps.filter((a) => a.status === 'pending').length} awaiting review</p></div><div class="actions"><button type="button" class="btn btn-outline" data-action="schedule-today">Today</button><input type="date" id="schedule-date" value="${date}" aria-label="Schedule date"></div></div><div class="schedule-legend"><span><i class="legend-dot sage"></i>Grooming team</span><span><i class="legend-dot lavender"></i>Veterinary team</span><span>All times · Asia/Manila</span></div><div class="table-wrap"><table class="schedule-table"><thead><tr><th>Time</th><th>Grooming team</th><th>Veterinary team</th></tr></thead><tbody>${state.data.timeSlots
    .map(
      (time) =>
        `<tr><th>${timeLabel(time)}</th>${['groomer', 'veterinarian']
          .map((resource) => {
            const visits = apps.filter((a) => a.time === time && a.resource === resource);
            const blocked = state.data.schedule.blocked.find(
              (b) => b.date === date && b.resource === resource && (!b.time || b.time === time),
            );
            const closed = !state.data.schedule.weekdays.includes(
              new Date(`${date}T12:00Z`).getUTCDay(),
            );
            return `<td>${visits.length ? visits.map((a) => `<button type="button" class="schedule-visit ${resource === 'groomer' ? 'sage' : 'lavender'}" data-action="find-appointment" data-id="${a.id}"><div><strong>${e(a.petName)}</strong>${statusBadge(a.status)}</div><small>${e(a.serviceName)}</small><small>${e(a.customerName)}</small></button>`).join('') : `<span class="schedule-open ${blocked || closed ? 'muted' : ''}">${blocked ? `Blocked · ${e(blocked.reason || 'Team unavailable')}` : closed ? 'Clinic closed' : 'No visits starting here'}</span>`}</td>`;
          })
          .join('')}</tr>`,
    )
    .join(
      '',
    )}</tbody></table></div></section><section class="panel blocked-panel"><div class="panel-header"><div><h2>Time away from the calendar</h2><p>Blocked times keep new visits from being booked.</p></div>${button('Block time', 'block-add', 'plus', 'soft')}</div>${state.data.schedule.blocked.length ? state.data.schedule.blocked.map((b) => `<div class="payment-row"><div><strong>${b.resource === 'groomer' ? 'Grooming team' : 'Veterinary team'} · ${dateLabel(b.date)}</strong><small>${b.time ? timeLabel(b.time) : 'All day'}${b.reason ? ` · ${e(b.reason)}` : ''}</small></div>${button('Reopen', 'block-remove', '', 'outline', `data-id="${b.id}"`)}</div>`).join('') : '<p class="panel-empty-note">No blocked times. Add time off or a temporary closure here.</p>'}</section>`;
}

export function services() {
  return `${heading('Thoughtful care, clearly defined', 'Services', 'Keep the service menu and prices up to date.')}<div class="service-management-grid">${state.data.services.map((s) => `<section class="panel service-management-card"><div class="service-card-top"><span class="icon-tile ${s.id === 'grooming' ? 'peach' : 'lavender'}">${icon(s.id)}</span><span class="status ${s.active ? 'confirmed' : 'cancelled'}">${s.active ? 'Available' : 'Paused'}</span></div><span class="eyebrow">${e(s.group)}</span><h2>${e(s.name)}</h2><p>${e(s.description)}</p><dl><div><dt>Estimated price</dt><dd>${money(s.basePrice)}</dd></div><div><dt>Care team</dt><dd>${s.resource === 'groomer' ? 'Grooming' : 'Veterinary'}</dd></div></dl>${button('Edit service', 'service-edit', 'edit', 'outline', `data-id="${s.id}"`)}</section>`).join('')}</div>`;
}

export function accounts() {
  return `${heading('The right access for the right people', 'Accounts', 'Manage customer, employee, and administrator access.')}<section class="panel"><div class="panel-header"><div><h2>People at PetServe</h2><p>${state.data.users.length} accounts · public registration creates customer accounts.</p></div></div><div class="table-wrap"><table><thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Manage</th></tr></thead><tbody>${state.data.users.map((u) => `<tr><td><strong>${e(u.name)}</strong><small>${e(u.email)}</small></td><td>${u.role === 'admin' ? 'Administrator' : u.role === 'staff' ? 'Employee' : 'Customer'}</td><td><span class="status ${u.disabled ? 'cancelled' : 'confirmed'}">${u.disabled ? 'Inactive' : 'Active'}</span></td><td>${button('Edit access', 'user-edit', 'shield', 'soft', `data-id="${u.id}"`)}</td></tr>`).join('')}</tbody></table></div></section><div class="subtle-note">${icon('shield')}<p>Customers can access their own care records. Employees manage clinic workflows. Administrators also manage account access.</p></div>`;
}

export function account() {
  const u = state.data.user;
  return `${heading('Your details, close at hand', 'My account', 'Keep your name and contact number up to date.')}<div class="account-layout"><section class="panel account-form"><div class="panel-header"><div><h2>Your profile</h2><p>These details help the care team keep in touch.</p></div></div><form data-form="account">${field('Full name', 'name', u.name, { required: true, attrs: 'minlength="2" maxlength="80" autocomplete="name"' })}${field('Phone number', 'phone', u.phone, { type: 'tel', attrs: 'maxlength="30" autocomplete="tel"' })}${field('Email address', 'email', u.email, { type: 'email', attrs: 'disabled', hint: 'Your sign-in email.' })}<div class="form-error" role="alert" hidden></div><button type="submit" class="btn btn-primary">Save details</button></form></section><section class="account-aside care-note sage"><span class="icon-tile sage">${icon('pets')}</span><h2>A familiar face.<br>A happier visit.</h2><p>A current profile helps us connect your pets, appointments, and care records.</p><span class="status confirmed">${u.role === 'customer' ? 'Pet parent' : u.role === 'staff' ? 'Employee' : 'Administrator'}</span></section></div>${appearance()}`;
}

export function reports() {
  const r = state.report;
  return `${heading('A clear picture of the care you give', 'Reports', 'Review appointments, completed services, and recorded collections.', button('Export CSV', 'report-export', 'download', 'outline', r ? '' : 'disabled'))}<form data-form="report" class="panel report-filters">${field('Visit date from', 'from', state.reportFrom, { type: 'date' })}${field('Visit date to', 'to', state.reportTo, { type: 'date' })}<button type="submit" class="btn btn-primary">Apply dates</button><button type="button" class="btn btn-outline" data-action="report-reset">All dates</button><div class="form-error" role="alert" hidden></div></form>${
    !r
      ? '<section class="panel"><p class="panel-empty-note">Loading your report…</p></section>'
      : `${stats([
          ['Appointments', r.totalAppointments, 'calendar', 'sage'],
          ['Completed services', r.servicesCompleted, 'check', 'lavender'],
          ['Recorded collections', money(r.amountCollected), 'card', 'peach'],
          ['Awaiting payment', r.outstanding, 'clock', 'sand'],
        ])}<div class="reports-grid"><section class="panel"><div class="panel-header"><div><h2>Visit status</h2><p>Where each appointment is in its care journey.</p></div></div><div class="status-bars">${Object.entries(
          r.counts,
        )
          .map(
            ([status, count]) =>
              `<div class="status-bar-item"><div>${statusBadge(status)}<strong>${count} <small>(${Math.round((count / (r.totalAppointments || 1)) * 100)}%)</small></strong></div><progress class="${status}" value="${count}" max="${r.totalAppointments || 1}" aria-label="${status} appointments">${count}</progress></div>`,
          )
          .join(
            '',
          )}</div></section><section class="panel"><div class="panel-header"><div><h2>Services at a glance</h2><p>Activity and collections by service.</p></div></div><div class="table-wrap"><table><thead><tr><th>Service</th><th>Booked</th><th>Done</th><th>Collected</th></tr></thead><tbody>${r.services.map((s) => `<tr><td><strong>${e(s.name)}</strong></td><td>${s.bookings}</td><td>${s.completed}</td><td>${money(s.collected)}</td></tr>`).join('')}</tbody></table></div></section></div><p class="report-caption">${r.paymentsRecorded} payment records. Date filters use appointment dates; collections include payments linked to those visits.</p>`
  }`;
}
