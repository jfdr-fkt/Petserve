import { field } from './components.js';
import { escapeHTML as e } from './utils.js';

export function staffDialog(type, id, draft) {
  if (type === 'staff-member')
    return {
      title: id ? 'Edit staff member' : 'Add staff member',
      description: '',
      label: 'Save staff member',
      content: `${field('Full name', 'name', draft.name, { required: true, attrs: 'minlength="2" maxlength="80" autocomplete="name"' })}${field('Position', 'position', draft.position, { required: true, attrs: 'minlength="2" maxlength="80"', placeholder: 'e.g. Groomer or Veterinarian' })}`,
    };
  if (type === 'staff-remove')
    return {
      title: 'Remove staff member?',
      description: '',
      label: 'Remove from list',
      content: `<p>${e(draft.name)} will be removed from the staff list.</p>`,
    };
  return null;
}
