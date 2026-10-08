import { composeSurface } from './interaction-engine.js';

const channels = Object.freeze({ media: Symbol(), axis: Symbol() });
function projectMedia(origin) {
  if (document.querySelector('.ambient-surface')) return;
  const element = document.createElement('section');
  element.className = 'ambient-surface';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-label', 'Media');
  element.innerHTML =
    '<button type="button" class="ambient-close" aria-label="Close">×</button><video src="/assets/ambient/649ef01382ee0819.mp4" controls playsinline preload="auto"></video>';
  const background = [...document.body.children].filter(
    (node) => node instanceof HTMLElement && !['SCRIPT', 'LINK'].includes(node.tagName),
  );
  const previous = background.map((node) => [node, node.inert]);
  previous.forEach(([node]) => {
    node.inert = true;
  });
  document.body.append(element);
  const video = element.querySelector('video');
  const close = () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    element.remove();
    previous.forEach(([node, inert]) => {
      node.inert = inert;
    });
    document.removeEventListener('keydown', onKey, true);
    if (origin.isConnected) origin.closest('a')?.focus({ preventScroll: true });
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.stopImmediatePropagation();
      close();
    }
    if (event.key === 'Tab') {
      const nodes = [...element.querySelectorAll('button,video')];
      const index = nodes.indexOf(document.activeElement);
      event.preventDefault();
      nodes[(index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length].focus();
    }
  };
  element.querySelector('button').addEventListener('click', close, { once: true });
  video.addEventListener('ended', close, { once: true });
  document.addEventListener('keydown', onKey, true);
  element.querySelector('button').focus({ preventScroll: true });
  video.volume = 0.75;
  video.play().catch(() => {});
}
function projectAxis() {
  const previous = document.body.classList.contains('surface-reflected');
  document.body.style.setProperty('--surface-axis', `${window.scrollY + innerHeight / 2}px`);
  document.body.classList.toggle('surface-reflected');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
    document.body.animate(
      [
        { transform: previous ? 'rotate(0.5turn)' : 'rotate(0turn)' },
        { transform: previous ? 'rotate(0turn)' : 'rotate(0.5turn)' },
      ],
      { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
}
let scheduled = false;
const align = () => {
  if (scheduled || !document.body.classList.contains('surface-reflected')) return;
  scheduled = true;
  requestAnimationFrame(() => {
    document.body.style.setProperty('--surface-axis', `${window.scrollY + innerHeight / 2}px`);
    scheduled = false;
  });
};
window.addEventListener('scroll', align, { passive: true });
window.addEventListener('resize', align);
composeSurface(
  '.brand-mark',
  [
    { key: Symbol(), mode: 'sum', boundary: 0x14, effect: channels.media },
    { key: Symbol(), mode: 'span', boundary: 10 ** 4, effect: channels.axis },
  ],
  new Map([
    [channels.media, projectMedia],
    [channels.axis, projectAxis],
  ]),
);
