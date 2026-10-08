import { state } from './state.js';
import { field } from './components.js';
import { escapeHTML as e } from './utils.js';

export function accountDialog(type, id) {
  if (type === 'password-change')
    return {
      title: 'Change your password',
      description: 'Your other signed-in sessions will be signed out.',
      content: `${field('Current password', 'currentPassword', '', { type: 'password', required: true, attrs: 'autocomplete="current-password" maxlength="128"' })}${field('New password', 'newPassword', '', { type: 'password', required: true, attrs: 'autocomplete="new-password" minlength="8" maxlength="128"', hint: '8 to 128 characters.' })}${field('Confirm new password', 'confirmPassword', '', { type: 'password', required: true, attrs: 'autocomplete="new-password" minlength="8" maxlength="128"' })}`,
      label: 'Update password',
    };
  if (type === 'password-reset-link')
    return {
      title: 'Account recovery',
      description: 'Give this link to the account owner after verifying their identity.',
      content: `<p>This link expires in 20 minutes and works once.</p>${field('Reset link', 'resetLink', `${location.origin}${state.draft.resetPath}`, { attrs: 'readonly' })}`,
      label: 'Done',
    };
  if (type === 'chat-clear')
    return {
      title: 'Delete this conversation?',
      description:
        'All messages, photos, and videos in this conversation will be permanently deleted for both sides.',
      content:
        '<p>You can start a new conversation afterward.</p><label class="check-option"><input type="checkbox" name="confirm" required><span>Delete the entire conversation.</span></label>',
      label: 'Delete conversation',
    };
  if (type === 'chat-delete')
    return {
      title: 'Delete this message?',
      description: 'The message and any attachment will be removed for both participants.',
      content: '<p>A “Message deleted” marker will remain in the conversation.</p>',
      label: 'Delete message',
    };
  if (type !== 'account-delete') return null;
  const account = id ? state.data.users.find((user) => user.id === id) : state.data.user;
  return {
    title: 'Delete this account?',
    description:
      account.id === state.data.user.id
        ? 'This permanently removes your sign-in access and contact details.'
        : `Permanently remove ${account.name}’s sign-in access and contact details.`,
    content: `<div class="account-deletion-note"><p>Chat messages, attachments, feedback, and uploaded gallery posts are removed. Upcoming visits are cancelled. Pet profiles are archived; clinic care and payment records are kept.</p></div>${field('Your current password', 'password', '', { type: 'password', required: true, attrs: 'autocomplete="current-password" maxlength="128"' })}<label class="check-option"><input type="checkbox" name="confirm" required><span>I understand that ${e(account.name)}’s account will be permanently deleted.</span></label>`,
    label: 'Delete account',
  };
}
