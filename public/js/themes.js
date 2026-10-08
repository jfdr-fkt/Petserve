import { state } from './state.js';
import { icon } from './components.js';
export const themes = [
  ['light', 'Petopia light', 'Blue, yellow, and clean white.'],
  ['dark', 'Midnight', 'Calm dark surfaces and gentle contrast.'],
  ['sage', 'Soft sage', 'Warm white with leafy green accents.'],
  ['system', 'Match device', 'Follow your device’s light or dark setting.'],
];
export function applyTheme(preference) {
  state.theme = themes.some(([id]) => id === preference) ? preference : 'light';
  const resolved =
    state.theme === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : state.theme;
  document.documentElement.dataset.theme = resolved;
  try {
    localStorage.setItem('petserve-theme', state.theme);
  } catch {}
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      'content',
      resolved === 'dark' ? '#141e29' : resolved === 'sage' ? '#eff3ed' : '#315f86',
    );
}
export function appearance() {
  return `<section class="panel appearance-panel"><div class="panel-header"><div><h2>Make yourself comfortable</h2><p>Choose a theme. Your preference stays on this device.</p></div>${icon('theme')}</div><div class="theme-options">${themes.map(([id, label, detail]) => `<button type="button" class="theme-option ${state.theme === id ? 'selected' : ''}" data-action="theme-select" data-theme="${id}" aria-pressed="${state.theme === id}"><span class="theme-swatch theme-${id}"><i></i><i></i><i></i></span><strong>${label}</strong><small>${detail}</small>${state.theme === id ? icon('check') : ''}</button>`).join('')}</div></section>`;
}
try {
  state.theme = localStorage.getItem('petserve-theme') || 'light';
} catch {}
applyTheme(state.theme);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme('system');
});
