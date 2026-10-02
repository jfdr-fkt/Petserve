// public/js/api.js — All server communication: fetch wrapper and data refresh.

const toastElement = document.querySelector('#toast');

async function api(route, method = 'GET', data) {
  const response = await fetch(route, {
    method,
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    credentials: 'same-origin'
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}

function toast(message, error = false) {
  toastElement.innerHTML = `${error ? '⚠️' : '✓'} &nbsp;<span>${escapeHTML(message)}</span>`;
  toastElement.classList.toggle('error', error);
  toastElement.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toastElement.classList.remove('show'), 3800);
}

async function refresh() {
  state.data = await api('/api/bootstrap');
  render();
}
