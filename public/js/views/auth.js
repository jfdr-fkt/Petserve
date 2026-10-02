// public/js/views/auth.js — Login and registration view.

const PRESET_PET_PHOTOS = [
  { name: 'Golden Dog',    url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=300&auto=format&fit=crop&q=80' },
  { name: 'Husky Dog',     url: 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=300&auto=format&fit=crop&q=80' },
  { name: 'Playful Puppy', url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=300&auto=format&fit=crop&q=80' },
  { name: 'Cute Cat',      url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&auto=format&fit=crop&q=80' },
  { name: 'Fluffy Kitten', url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=300&auto=format&fit=crop&q=80' }
];

function brand() {
  return `<span class="brand-mark" aria-hidden="true">${icons.brand}</span><span>PetServe<span class="brand-dot">.</span></span>`;
}

function renderAuth() {
  const reg = state.authMode === 'register';
  root.innerHTML = `
  <div class="auth-shell">
    <section class="auth-story">
      <a class="brand" href="/">${brand()}</a>
      <div class="story-main">
        <span class="eyebrow">Petopia Pet Care Services</span>
        <h1>Good care starts<br>with a plan.</h1>
        <p>One simple place for pet photos, visit requests, online payments, and complete health history.</p>
        <div class="story-features">
          <span>01 &nbsp;Pet profiles &amp; photos</span>
          <span>02 &nbsp;Online payments</span>
          <span>03 &nbsp;Vaccine &amp; health logs</span>
        </div>
        <div class="story-card-preview">
          <div class="preview-header">
            <strong>Saturday Grooming</strong>
            <span class="status confirmed">● Paid Online</span>
          </div>
          <p>Milo · 10:00 AM Manila Time</p>
        </div>
      </div>
      <div class="story-footer">50% Scope Presentation Prototype. Pet pictures, online payments, and service history demo ready.</div>
    </section>
    <section class="auth-side">
      <div class="auth-card">
        <span class="eyebrow">Welcome to PetServe</span>
        <h2>${reg ? 'Create your account' : 'Sign in to your space'}</h2>
        <p>${reg ? 'Start with a customer account, then add your first pet.' : 'Keep your pet\u2019s visits organized from request to receipt.'}</p>
        <div class="auth-tabs" role="tablist" aria-label="Account options">
          <button type="button" data-auth-mode="login"     class="${reg ? '' : 'active'}" role="tab" aria-selected="${!reg}">Sign in</button>
          <button type="button" data-auth-mode="register"  class="${reg ? 'active' : ''}" role="tab" aria-selected="${reg}">Create account</button>
        </div>
        <form data-form="auth">
          ${reg ? `<div class="field"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" maxlength="80" placeholder="Your full name" required></div>` : ''}
          <div class="field">
            <label for="auth-email">Email address</label>
            <input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
          </div>
          <div class="field">
            <label for="auth-password">Password</label>
            <input id="auth-password" name="password" type="password"
              autocomplete="${reg ? 'new-password' : 'current-password'}"
              minlength="${reg ? 8 : 1}"
              placeholder="${reg ? 'At least 8 characters' : 'Enter your password'}" required>
          </div>
          <button class="btn btn-primary btn-block" type="submit">
            ${reg ? 'Create customer account' : 'Sign in'} <span aria-hidden="true">→</span>
          </button>
        </form>
        <div class="demo-box">
          <strong>Presentation demo accounts</strong>
          Customer: <code>alex@example.test</code><br>
          Staff: <code>staff@petserve.test</code><br>
          Password for both: <code>Petserve123!</code>
          <div class="demo-box-actions">
            <button type="button" class="btn btn-soft btn-small" data-fill="customer">Fill customer</button>
            <button type="button" class="btn btn-soft btn-small" data-fill="staff">Fill staff</button>
          </div>
        </div>
      </div>
    </section>
  </div>`;
}
