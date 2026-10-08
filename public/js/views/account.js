import { state } from '../state.js';
import { heading, field, button } from '../components.js';
import { appearance } from '../themes.js';
import { profilePhotoMarkup } from '../profile.js';

export function account() {
  const user = state.data.user;
  return `<div class="account-page">${heading('Your space', 'My account', 'Manage your profile, appearance, and sign-in details.')}<section class="panel account-form"><div class="panel-header"><div><h2>Your profile</h2><p>Keep your details up to date.</p></div><span class="status confirmed">${user.role === 'customer' ? 'Pet parent' : user.role === 'staff' ? 'Employee' : 'Administrator'}</span></div><form data-form="account"><div id="profile-photo-editor" class="profile-photo-editor">${profilePhotoMarkup()}</div>${field('Full name', 'name', user.name, { required: true, attrs: 'minlength="2" maxlength="80" autocomplete="name"' })}${field('Phone number', 'phone', user.phone, { type: 'tel', attrs: 'maxlength="30" autocomplete="tel"' })}${field('Email address', 'email', user.email, { type: 'email', attrs: 'disabled', hint: 'Your sign-in email.' })}<div class="form-error" role="alert" hidden></div><button type="submit" class="btn btn-primary">Save details</button></form>${appearance()}<div class="account-preferences"><h2>Security</h2><div class="setting-row"><div><strong>Password</strong><p>Choose a new password for your account.</p></div>${button('Change password', 'password-change', '', 'outline')}</div><div class="setting-row account-delete-row"><div><strong>Delete account</strong><p>Permanently remove your sign-in and profile.</p></div>${button('Delete my account', 'account-delete', 'trash', 'outline')}</div></div></section></div>`;
}
