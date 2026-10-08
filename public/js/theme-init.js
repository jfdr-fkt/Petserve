// Apply the saved palette before the stylesheet is painted.
(() => {
  let preference = 'light';
  try {
    preference = localStorage.getItem('petserve-theme') || 'light';
  } catch {}
  if (!['light', 'dark', 'sage', 'system'].includes(preference)) preference = 'light';
  document.documentElement.dataset.theme =
    preference === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;
})();
