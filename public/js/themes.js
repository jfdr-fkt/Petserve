import { state } from './state.js';
export const themes = [
  ['light', 'Petopia light'],
  ['dark', 'Midnight dark'],
  ['sage', 'Soft sage'],
  ['system', 'Match device'],
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
  return `<div class="account-preferences"><h2>Appearance</h2><div class="setting-row"><div><label for="theme-select">Color theme</label><p>Saved on this device.</p></div><select id="theme-select" aria-label="Color theme">${themes.map(([id, label]) => `<option value="${id}" ${state.theme === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div>`;
}
try {
  state.theme = localStorage.getItem('petserve-theme') || 'light';
} catch {}
applyTheme(state.theme);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme('system');
});
