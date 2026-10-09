import { field } from './components.js';
import { escapeHTML as e } from './utils.js';
import { state } from './state.js';

function supervisorChoices(id) {
  const descendants = new Set(id ? [id] : []);
  let added;
  do {
    added = false;
    for (const member of state.data.staffDirectory)
      if (descendants.has(member.reportsTo) && !descendants.has(member.id)) {
        descendants.add(member.id);
        added = true;
      }
  } while (added);
  return [
    ['', 'Top of hierarchy'],
    ...state.data.staffDirectory
      .filter((member) => !descendants.has(member.id))
      .map((member) => [member.id, `${member.name} · ${member.position}`]),
  ];
}

export function staffDialog(type, id, draft) {
  if (type === 'staff-member')
    return {
      title: id ? 'Edit staff member' : 'Add staff member',
      description: '',
      label: 'Save staff member',
      content: `${field('Full name', 'name', draft.name, { required: true, attrs: 'minlength="2" maxlength="80" autocomplete="name"' })}${field('Position', 'position', draft.position, { required: true, attrs: 'minlength="2" maxlength="80"', placeholder: 'e.g. Groomer or Veterinarian' })}${field('Reports to', 'reportsTo', draft.reportsTo || '', { choices: supervisorChoices(id) })}`,
    };
  if (type === 'staff-remove')
    return {
      title: 'Remove staff member?',
      description: '',
      label: 'Remove from list',
      content: `<p>${e(draft.name)} will be removed from the staff list.</p>${state.data.staffDirectory.some((member) => member.reportsTo === id) ? '<p>Their direct reports will move up one level.</p>' : ''}`,
    };
  return null;
}
