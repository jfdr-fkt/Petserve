import { petScene } from './pet-scenes.js';

// Runs once after successful sign-in, independently of page navigation.
export function loginWelcome(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  return new Promise((resolve) => {
    const welcome = document.createElement('section');
    welcome.className = 'login-welcome';
    welcome.setAttribute('role', 'dialog');
    welcome.setAttribute('aria-modal', 'true');
    welcome.setAttribute('aria-labelledby', 'welcome-title');
    welcome.innerHTML = `<div class="login-welcome-card"><span class="eyebrow">HELLO, HAPPY PAWS</span>${petScene('run')}<h1 id="welcome-title">A happy little hello.</h1><p>Your care space is ready. Come on in.</p><button type="button" class="btn btn-outline">Go to dashboard</button></div>`;
    const previouslyInert = root.inert;
    root.inert = true;
    document.body.classList.add('welcome-open');
    document.body.append(welcome);
    const button = welcome.querySelector('button');
    const finish = () => {
      clearTimeout(timer);
      welcome.remove();
      root.inert = previouslyInert;
      document.body.classList.remove('welcome-open');
      document.removeEventListener('keydown', onKey);
      resolve();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'Tab') {
        event.preventDefault();
        button.focus({ preventScroll: true });
      }
    };
    const timer = setTimeout(finish, 1800);
    button.addEventListener('click', finish, { once: true });
    document.addEventListener('keydown', onKey);
    button.focus({ preventScroll: true });
  });
}
