import { state } from './state.js';
import { api, toast, uploadChatMedia } from './api.js';
import {
  threadList,
  chatMessages,
  chatMessageMarkup,
  messageVersion,
  chatAttachmentPreview,
} from './views/chat.js';
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
  const nearEnd =
    messages && messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
  state.chatMessages = thread.messages;
  state.chatLoading = false;
  if (messages && thread.messages.length) {
    const nodes = new Map(
      [...messages.querySelectorAll('[data-message-id]')].map((element) => [
        element.dataset.messageId,
        element,
      ]),
    );
    if (!nodes.size) messages.replaceChildren();
    for (const [id, node] of nodes)
      if (!thread.messages.some((message) => message.id === id)) node.remove();
    thread.messages.forEach((message, index) => {
      let node = nodes.get(message.id);
      if (!node || node.dataset.version !== messageVersion(message)) {
        const template = document.createElement('template');
        template.innerHTML = chatMessageMarkup(message);
        const replacement = template.content.firstElementChild;
        if (node) node.replaceWith(replacement);
        node = replacement;
      }
      if (messages.children[index] !== node)
        messages.insertBefore(node, messages.children[index] || null);
    });
    if (nearEnd || state.chatForceScroll) messages.scrollTop = messages.scrollHeight;
    state.chatForceScroll = false;
  } else if (messages && !messages.querySelector('.empty-state')) {
    messages.innerHTML = chatMessages();
  }
  const threads = await api('/api/chat');
  if (current !== revision || state.view !== 'chat') return;
  if (JSON.stringify(state.data.chatThreads) !== JSON.stringify(threads.threads)) {
    state.data.chatThreads = threads.threads;
    updateThreadList();
  }
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
  if (!text.trim() && !state.chatFile)
    throw new Error('Write a message or attach a photo or video.');
  if (state.chatSending) return;
  const customerId = state.chatCustomerId;
  composerBusy(true);
  try {
    if (state.chatFile) await uploadChatMedia(customerId, state.chatFile, text);
    else await api(`/api/chat/${customerId}`, 'POST', { text });
    if (state.view !== 'chat' || customerId !== state.chatCustomerId) return;
    state.chatDraft = '';
    clearChatAttachment();
    state.chatForceScroll = true;
    const input = document.querySelector('#chat-text');
    if (input) {
      input.value = '';
      input.focus();
    }
    await loadChat();
  } finally {
    composerBusy(false);
  }
}
function composerBusy(busy) {
  state.chatSending = busy;
  const form = document.querySelector('form[data-form="chat"]');
  if (!form) return;
  form.setAttribute('aria-busy', String(busy));
  form.querySelector('textarea').readOnly = busy;
  form.querySelector('[type=submit]').disabled = busy;
  form.querySelector('[type=submit] span').textContent = busy ? 'Sending…' : 'Send';
  form.querySelector('[type=file]').disabled = busy;
  const remove = form.querySelector('[data-action="chat-attachment-remove"]');
  if (remove) remove.disabled = busy;
}
export function clearChatAttachment() {
  if (state.chatPreview) URL.revokeObjectURL(state.chatPreview);
  state.chatFile = null;
  state.chatPreview = '';
  document.querySelector('#chat-attachment-preview')?.replaceChildren();
  const input = document.querySelector('#chat-file');
  if (input) input.value = '';
}
export function chooseChatAttachment(file) {
  if (!file) return;
  if (
    !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type) ||
    file.size > 25 * 1024 * 1024
  )
    throw new Error('Choose a JPG, PNG, WebP, MP4 or WebM file up to 25 MB.');
  clearChatAttachment();
  state.chatFile = file;
  state.chatPreview = URL.createObjectURL(file);
  const preview = document.querySelector('#chat-attachment-preview');
  if (preview) preview.innerHTML = chatAttachmentPreview();
}
export async function deleteChatMessage(id) {
  await api(`/api/chat/${state.chatCustomerId}/messages/${id}`, 'DELETE');
  if (state.view === 'chat') await loadChat();
}
export function reportChatError(error) {
  toast(error.message, true);
}
