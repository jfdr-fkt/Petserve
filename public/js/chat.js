import { state } from './state.js';
import { api, toast } from './api.js';
import { threadList, chatMessages } from './views/chat.js';
let timer,
  revision = 0,
  polling = false;
export function stopChat() {
  clearTimeout(timer);
  revision++;
  polling = false;
}
function updateThreadList() {
  const element = document.querySelector('#chat-threads');
  if (element) element.innerHTML = threadList();
  const count = state.data.chatThreads.reduce((sum, thread) => sum + thread.unread, 0);
  document.querySelector('.chat-nav-count')?.replaceChildren(String(count || ''));
}
export function searchChat(value) {
  state.chatSearch = value;
  updateThreadList();
}
export async function loadChat() {
  const current = revision,
    customerId = state.chatCustomerId;
  if (!customerId || !state.data?.user || state.view !== 'chat') return;
  const thread = await api(`/api/chat/${customerId}`);
  if (current !== revision || customerId !== state.chatCustomerId || state.view !== 'chat') return;
  const messages = document.querySelector('#chat-messages');
  const changed =
    state.chatMessages.map((m) => m.id).join() !== thread.messages.map((m) => m.id).join();
  const nearEnd =
    messages && messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
  state.chatMessages = thread.messages;
  state.chatLoading = false;
  if (messages && (changed || !messages.querySelector('.chat-message'))) {
    messages.innerHTML = chatMessages();
    if (nearEnd || state.chatForceScroll) messages.scrollTop = messages.scrollHeight;
    state.chatForceScroll = false;
  }
  const threads = await api('/api/chat');
  if (current !== revision || state.view !== 'chat') return;
  state.data.chatThreads = threads.threads;
  updateThreadList();
  const title = document.querySelector('#chat-title');
  if (title && state.data.user.role !== 'customer') title.textContent = thread.customerName;
  const connection = document.querySelector('#chat-connection');
  if (connection)
    connection.textContent = 'Messages refresh automatically while this page is open.';
}
export function startChat() {
  stopChat();
  const current = revision;
  const poll = async () => {
    if (current !== revision || state.view !== 'chat' || !state.data?.user) return;
    if (!document.hidden && !polling) {
      polling = true;
      try {
        await loadChat();
      } catch {
        const status = document.querySelector('#chat-connection');
        if (status) status.textContent = 'Connection interrupted. Retrying…';
      } finally {
        if (current === revision) polling = false;
      }
    }
    if (current === revision) timer = setTimeout(poll, 3000);
  };
  poll();
}
export async function sendChat(text) {
  if (!text.trim()) throw new Error('Write a message first.');
  const customerId = state.chatCustomerId;
  await api(`/api/chat/${customerId}`, 'POST', { text });
  if (state.view !== 'chat' || customerId !== state.chatCustomerId) return;
  state.chatDraft = '';
  state.chatForceScroll = true;
  const input = document.querySelector('#chat-text');
  if (input) {
    input.value = '';
    input.focus();
  }
  await loadChat();
}
export function reportChatError(error) {
  toast(error.message, true);
}
