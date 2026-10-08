import { escapeHTML } from './utils.js';
export async function api(route, method = 'GET', data) {
  const response = await fetch(route, {
    method,
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
    credentials: 'same-origin',
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body;
}
export async function uploadMedia(file, details, route = '/api/gallery') {
  const response = await fetch(`${route}?${new URLSearchParams(details)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
    credentials: 'same-origin',
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'The media could not be uploaded.');
  return body;
}
export async function uploadChatMedia(customerId, file, text) {
  const caption = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
  const response = await fetch(`/api/chat/${customerId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'X-Message-Caption': caption },
    body: file,
    credentials: 'same-origin',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The attachment could not be sent.');
  return result;
}
export function toast(message, error = false) {
  const element = document.querySelector('#toast');
  element.innerHTML = `<span>${error ? '!' : '✓'}</span> ${escapeHTML(message)}`;
  element.classList.toggle('error', error);
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 4200);
}
