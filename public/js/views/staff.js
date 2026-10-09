import { state } from '../state.js';
import { heading, button, empty, icon } from '../components.js';
import { escapeHTML as e } from '../utils.js';

export function staff() {
  const admin = state.data.user.role === 'admin';
  const members = state.data.staffDirectory;
  const roots = members.filter((member) => !member.reportsTo);
  const chart =
    roots.length > 1
      ? `<ul class="staff-tree staff-roots"><li class="staff-node"><article class="panel staff-company-card" data-staff-level="0"><span class="staff-avatar staff-company-avatar" aria-hidden="true">${icon('brand')}</span><div class="staff-identity"><h2>Petopia</h2></div></article>${staffBranch(members, '', admin, 1, 'staff-reports')}</li></ul>`
      : staffBranch(members, '', admin);
  return `${heading('Staff list', admin ? button('Add staff member', 'staff-add', 'plus') : '')}${
    members.length
      ? `<div class="staff-hierarchy" role="region" aria-label="Staff organizational chart" tabindex="0"><div class="staff-chart-canvas">${chart}</div></div>`
      : `<section class="panel">${empty('No staff listed', '', admin ? button('Add staff member', 'staff-add', 'plus', 'soft') : '', 'settings')}</section>`
  }`;
}

function staffBranch(
  members,
  supervisor,
  admin,
  depth = 0,
  listClass = supervisor ? 'staff-reports' : 'staff-roots',
) {
  const reports = members.filter((member) => member.reportsTo === supervisor);
  if (!reports.length) return '';
  return `<ul class="staff-tree ${listClass}">${reports.map((member) => `<li class="staff-node" data-staff-id="${member.id}"><article class="panel staff-card" data-staff-level="${depth}"><span class="user-avatar staff-avatar" aria-hidden="true">${e(member.name[0])}</span><div class="staff-identity"><h2>${e(member.name)}</h2><p>${e(member.position)}</p></div>${admin ? `<div class="actions">${button('Edit', 'staff-edit', 'edit', 'outline', `data-id="${member.id}" aria-label="Edit ${e(member.name)}"`)}${button('Remove', 'staff-remove', 'trash', 'outline', `data-id="${member.id}" aria-label="Remove ${e(member.name)}"`)}</div>` : ''}</article>${staffBranch(members, member.id, admin, depth + 1)}</li>`).join('')}</ul>`;
}

export function positionStaffChart() {
  const chart = document.querySelector('.staff-hierarchy');
  if (!chart) return;
  const cards = [...chart.querySelectorAll('[data-staff-level]')];
  const heights = new Map();
  for (const card of cards)
    heights.set(
      card.dataset.staffLevel,
      Math.max(heights.get(card.dataset.staffLevel) || 0, card.offsetHeight),
    );
  for (const card of cards) card.style.minHeight = `${heights.get(card.dataset.staffLevel)}px`;
  for (const branch of [...chart.querySelectorAll('.staff-reports')].reverse()) {
    const siblings = [...branch.children];
    if (siblings.length < 2) continue;
    const width = Math.max(...siblings.map((node) => node.offsetWidth));
    for (const node of siblings) node.style.minWidth = `${width}px`;
  }
  const root = chart.querySelector('.staff-roots > .staff-node > article');
  if (root && Number(chart.dataset.viewportWidth) !== chart.clientWidth) {
    const box = root.getBoundingClientRect();
    chart.scrollLeft +=
      box.left + box.width / 2 - chart.getBoundingClientRect().left - chart.clientWidth / 2;
  }
  chart.dataset.viewportWidth = String(chart.clientWidth);
}
