import { state } from '../state.js';
import { heading, button, empty } from '../components.js';
import { escapeHTML as e } from '../utils.js';

export function staff() {
  const admin = state.data.user.role === 'admin';
  const members = state.data.staffDirectory;
  return `${heading('Staff list', admin ? button('Add staff member', 'staff-add', 'plus') : '')}${
    members.length
      ? `<div class="staff-hierarchy" aria-label="Staff hierarchy">${staffBranch(members, '', admin)}</div>`
      : `<section class="panel">${empty('No staff listed', '', admin ? button('Add staff member', 'staff-add', 'plus', 'soft') : '', 'settings')}</section>`
  }`;
}

function staffBranch(members, supervisor, admin) {
  const reports = members.filter((member) => member.reportsTo === supervisor);
  if (!reports.length) return '';
  return `<ul class="staff-tree ${supervisor ? 'staff-reports' : 'staff-roots'}">${reports.map((member) => `<li class="staff-node" data-staff-id="${member.id}"><article class="panel staff-card"><span class="user-avatar staff-avatar" aria-hidden="true">${e(member.name[0])}</span><div class="staff-identity"><h2>${e(member.name)}</h2><p>${e(member.position)}</p></div>${admin ? `<div class="actions">${button('Edit', 'staff-edit', 'edit', 'outline', `data-id="${member.id}" aria-label="Edit ${e(member.name)}"`)}${button('Remove', 'staff-remove', 'trash', 'outline', `data-id="${member.id}" aria-label="Remove ${e(member.name)}"`)}</div>` : ''}</article>${staffBranch(members, member.id, admin)}</li>`).join('')}</ul>`;
}
