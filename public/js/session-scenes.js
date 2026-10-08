import { petScene } from './pet-scenes.js';

// Session moments are isolated from workspace navigation. Both screens share
// focus trapping, dismissal, and cleanup while retaining their own artwork.
function showSessionScene(
  root,
  { className, title, description, eyebrow, scene, buttonText, duration },
) {
  return new Promise((resolve) => {
    const screen = document.createElement('section');
    screen.className = `session-scene ${className}`;
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-labelledby', 'session-scene-title');
    screen.setAttribute('aria-describedby', 'session-scene-description');
    screen.innerHTML = `<div class="session-scene-card"><span class="eyebrow">${eyebrow}</span>${petScene(scene)}<h1 id="session-scene-title">${title}</h1><p id="session-scene-description">${description}</p><button type="button" class="btn btn-outline">${buttonText}</button></div>`;
    const previouslyInert = root.inert;
    root.inert = true;
    document.body.classList.add('session-scene-open');
    document.body.append(screen);
    const button = screen.querySelector('button');
    const finish = () => {
      clearTimeout(timer);
      screen.remove();
      root.inert = previouslyInert;
      document.body.classList.remove('session-scene-open');
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
    const timer = setTimeout(finish, duration);
    button.addEventListener('click', finish, { once: true });
    document.addEventListener('keydown', onKey);
    button.focus({ preventScroll: true });
  });
}

export function loginWelcome(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  return showSessionScene(root, {
    className: 'login-welcome',
    eyebrow: 'HELLO, HAPPY PAWS',
    scene: 'run',
    title: 'A happy little hello.',
    description: 'Your care space is ready. Come on in.',
    buttonText: 'Go to dashboard',
    duration: 1800,
  });
}

export function logoutGoodbye(root) {
  return showSessionScene(root, {
    className: 'logout-goodbye',
    eyebrow: 'SIGNED OUT. SEE YOU SOON.',
    scene: 'goodbye',
    title: 'Until the next happy visit.',
    description: 'Take care of those little paws. We’ll be here when you need us.',
    buttonText: 'Back to sign in',
    duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1000 : 2400,
  });
}
