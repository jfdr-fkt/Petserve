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
  return `<form data-form="${reset ? 'reset-password' : 'forgot-password'}">${reset ? passwordField('New password', 'newPassword') + passwordField('Confirm new password', 'confirmPassword') : field('Email address', 'email', '', { type: 'email', required: true, attrs: 'autocomplete="email" maxlength="160"', placeholder: 'you@example.com' })}<div class="form-error" role="alert" hidden></div><button class="btn btn-primary btn-block" type="submit">${reset ? 'Reset password' : 'Send reset link'}${icon('arrow')}</button></form>${!reset && result ? `<section class="recovery-inbox" role="status"><strong>${result.resetPath ? 'Password reset link' : 'Check your recovery options'}</strong><p>${result.resetPath ? 'This link expires in 20 minutes and can be used once.' : e(result.message)}</p>${result.resetPath ? `<a class="btn btn-outline" href="${e(result.resetPath)}" data-action="reset-open" data-token="${e(result.resetPath.split('/').at(-1))}">Open password reset</a>` : ''}</section>` : ''}<div class="auth-recovery-actions"><button type="button" class="text-button" data-auth-mode="login">Back to sign in</button></div>`;
}
function signInForm(registering) {
  return `${state.resetComplete ? '<p class="reset-ready" role="status">Password updated. Sign in with your new password.</p>' : ''}<div class="tabs auth-tabs" aria-label="Account options"><button type="button" data-auth-mode="login" class="${registering ? '' : 'active'}">Sign in</button><button type="button" data-auth-mode="register" class="${registering ? 'active' : ''}">Create account</button></div><form data-form="auth">${registering ? field('Full name', 'name', '', { required: true, attrs: 'autocomplete="name" maxlength="80"', placeholder: 'Your full name' }) : ''}${field('Email address', 'email', '', { type: 'email', required: true, attrs: 'autocomplete="email" maxlength="160"', placeholder: 'you@example.com' })}${field('Password', 'password', '', { type: 'password', required: true, attrs: `autocomplete="${registering ? 'new-password' : 'current-password'}" minlength="${registering ? 8 : 1}" maxlength="128"`, placeholder: registering ? 'At least 8 characters' : 'Enter your password' })}${registering ? field('Phone number (optional)', 'phone', '', { type: 'tel', attrs: 'autocomplete="tel" maxlength="30"', placeholder: '09XX XXX XXXX' }) : ''}<div class="form-error" role="alert" hidden></div><button class="btn btn-primary btn-block" type="submit">${registering ? 'Create account' : 'Sign in'}${icon('arrow')}</button></form>${registering ? '' : '<div class="auth-recovery-actions"><button type="button" class="text-button" data-auth-mode="forgot">Forgot password?</button></div>'}<details class="demo-accounts"><summary>Quick sign in</summary><div class="actions"><button type="button" class="btn btn-soft" data-fill="customer">Customer</button><button type="button" class="btn btn-soft" data-fill="staff">Employee</button><button type="button" class="btn btn-soft" data-fill="admin">Administrator</button></div><small>Password: Petserve123!</small></details>`;
}
export function auth() {
  const registering = state.authMode === 'register',
    reset = state.authMode === 'reset',
    recovering = reset || state.authMode === 'forgot';
  const title = reset
    ? 'Reset password'
    : recovering
      ? 'Forgot your password?'
      : registering
        ? 'Create account'
        : 'Welcome back.';
  const description = reset
    ? 'Choose your new password.'
    : 'Enter your sign-in email to request a reset link.';
  return `<div class="auth-shell"><section class="auth-story"><a class="brand" href="/">${brand()}</a><div class="story-main"><h1>Little paws.<br>Big love.<br><em>Better care.</em></h1><div class="auth-art">${petScene()}</div></div><div class="story-footer">Petopia Pet Care Services · Tagum City</div></section><section class="auth-side"><div class="auth-card"><h2>${title}</h2>${recovering ? `<p>${description}</p>` : ''}${recovering ? recoveryForm(reset) : signInForm(registering)}</div></section></div>`;
}
