import { state } from '../state.js';
import { brand, field, icon } from '../components.js';
import { escapeHTML as e } from '../utils.js';
import { petScene } from '../pet-scenes.js';

const passwordField = (label, name) =>
  field(label, name, '', {
    type: 'password',
    required: true,
    attrs: 'autocomplete="new-password" minlength="8" maxlength="128"',
  });
function recoveryForm(reset) {
  const result = state.recoveryResult;
  return `<form data-form="${reset ? 'reset-password' : 'forgot-password'}">${reset ? passwordField('New password', 'newPassword') + passwordField('Confirm new password', 'confirmPassword') : field('Email address', 'email', '', { type: 'email', required: true, attrs: 'autocomplete="email" maxlength="160"', placeholder: 'you@example.com' })}<div class="form-error" role="alert" hidden></div><button class="btn btn-primary btn-block" type="submit">${reset ? 'Reset password' : 'Send reset link'}${icon('arrow')}</button></form>${!reset && result ? `<section class="recovery-inbox" role="status"><strong>${result.resetPath ? 'Demo inbox' : 'Check your recovery options'}</strong><p>${result.resetPath ? 'Demo addresses do not receive email. Open your reset link here; it expires in 20 minutes and works once.' : e(result.message)}</p>${result.resetPath ? `<a class="btn btn-outline" href="${e(result.resetPath)}" data-action="reset-open" data-token="${e(result.resetPath.split('/').at(-1))}">Open password reset</a>` : ''}</section>` : ''}<div class="auth-recovery-actions"><button type="button" class="text-button" data-auth-mode="login">Back to sign in</button></div>`;
}
function signInForm(registering) {
  return `${state.resetComplete ? '<p class="reset-ready" role="status">Password updated. Sign in with your new password.</p>' : ''}<div class="tabs auth-tabs" aria-label="Account options"><button type="button" data-auth-mode="login" class="${registering ? '' : 'active'}">Sign in</button><button type="button" data-auth-mode="register" class="${registering ? 'active' : ''}">Create account</button></div><form data-form="auth">${registering ? field('Full name', 'name', '', { required: true, attrs: 'autocomplete="name" maxlength="80"', placeholder: 'Your full name' }) : ''}${field('Email address', 'email', '', { type: 'email', required: true, attrs: 'autocomplete="email" maxlength="160"', placeholder: 'you@example.com' })}${field('Password', 'password', '', { type: 'password', required: true, attrs: `autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? 8 : 1}" maxlength="128"`, placeholder: registering ? 'At least 8 characters' : 'Enter your password' })}${registering ? field('Phone number (optional)', 'phone', '', { type: 'tel', attrs: 'autocomplete="tel" maxlength="30"', placeholder: '09XX XXX XXXX' }) : ''}<div class="form-error" role="alert" hidden></div><button class="btn btn-primary btn-block" type="submit">${registering ? 'Create account' : 'Sign in'}${icon('arrow')}</button></form>${registering ? '' : '<div class="auth-recovery-actions"><button type="button" class="text-button" data-auth-mode="forgot">Forgot password?</button></div>'}<details class="demo-accounts"><summary>Try a demo account</summary><p>Select a role to fill in the sign-in details.</p><div class="actions"><button type="button" class="btn btn-soft" data-fill="customer">Customer</button><button type="button" class="btn btn-soft" data-fill="staff">Employee</button><button type="button" class="btn btn-soft" data-fill="admin">Administrator</button></div><small>Password: Petserve123!</small></details>`;
}
export function auth() {
  const registering = state.authMode === 'register',
    reset = state.authMode === 'reset',
    recovering = reset || state.authMode === 'forgot';
  const title = reset
    ? 'A fresh start.'
    : recovering
      ? 'Forgot your password?'
      : registering
        ? 'Join the family.'
        : 'Welcome back.';
  const description = reset
    ? 'Choose a new password to get back to your pet’s care.'
    : recovering
      ? 'Enter your sign-in email to request a reset link.'
      : registering
        ? 'A happier care routine starts here.'
        : 'Your pets and their next happy visit are right here.';
  return `<div class="auth-shell"><section class="auth-story"><a class="brand" href="/">${brand()}</a><div class="story-main"><span class="eyebrow">A little planning. A lot of love.</span><h1>Little paws.<br>Big love.<br><em>Better care.</em></h1><p>Keep their care close. Plan a visit, know what’s next, and keep every little milestone in one place.</p><div class="auth-art">${petScene()}</div></div><div class="story-footer">Petopia Pet Care Services · Tagum City</div></section><section class="auth-side"><div class="auth-card"><span class="eyebrow">YOUR PET’S CARE, CONNECTED</span><h2>${title}</h2><p>${description}</p>${recovering ? recoveryForm(reset) : signInForm(registering)}<p class="auth-footnote">A caring space for you. A calmer day for them.</p></div></section></div>`;
}
