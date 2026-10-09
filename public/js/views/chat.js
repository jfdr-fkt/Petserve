import { state, isStaff } from '../state.js';
import { heading, icon, empty } from '../components.js';
import { escapeHTML as e } from '../utils.js';

const timestamp = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
});
export function threadList() {
  const threads = state.data.chatThreads.filter((thread) =>
    thread.customerName.toLowerCase().includes(state.chatSearch.toLowerCase()),
  );
  return threads.length
    ? threads
        .map(
          (thread) =>
            `<button type="button" class="chat-thread ${thread.customerId === state.chatCustomerId ? 'active' : ''}" data-action="chat-select" data-id="${thread.customerId}"><span class="user-avatar">${e(thread.customerName[0])}</span><span><strong>${e(thread.customerName)}</strong><small>${e(thread.lastMessage?.text || 'Start a conversation')}</small></span>${thread.unread ? `<b class="chat-unread">${thread.unread}</b>` : ''}</button>`,
        )
        .join('')
    : '<p class="panel-empty-note">No matching conversations.</p>';
}
export function messageVersion(message) {
  return `${message.deletedAt || ''}:${message.canDelete}:${message.attachment?.url || ''}:${message.text}:${message.senderName}`;
}
export function chatMessageMarkup(message) {
  const outgoing = isStaff() ? message.role !== 'customer' : message.role === 'customer';
  const media = message.attachment;
  const content = message.deletedAt
    ? '<p class="chat-removed">Message deleted</p>'
    : `${media ? (media.mime.startsWith('video/') ? `<video class="chat-media" src="${e(media.url)}" controls playsinline preload="metadata" aria-label="Video attachment"></video>` : `<a class="chat-photo-link" href="${e(media.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open photo attachment"><img class="chat-media" src="${e(media.url)}" alt="Photo shared by ${e(message.senderName)}" loading="lazy" decoding="async"></a>`) : ''}${message.text ? `<p>${e(message.text)}</p>` : ''}`;
  return `<article class="chat-message ${outgoing ? 'outgoing' : ''} ${message.deletedAt ? 'deleted' : ''}" data-message-id="${message.id}" data-version="${e(messageVersion(message))}"><div class="chat-message-header"><small>${e(message.senderName)}${message.role === 'customer' ? '' : ' · Care team'}</small>${message.canDelete && !message.deletedAt ? `<button type="button" class="icon-button chat-delete" data-action="chat-message-delete" data-id="${message.id}" aria-label="Delete message" title="Delete message">${icon('trash')}</button>` : ''}</div>${content}<time datetime="${message.createdAt}">${timestamp.format(new Date(message.createdAt))}</time></article>`;
}
export function chatMessages() {
  if (state.chatLoading && !state.chatMessages.length)
    return '<p class="panel-empty-note">Opening your conversation…</p>';
  return state.chatMessages.length
    ? state.chatMessages.map(chatMessageMarkup).join('')
    : empty(
        'A friendly conversation starts here',
        'Ask about a visit, a payment, or your pet’s care. The team will reply when available.',
        '',
        'chat',
      );
}
export function chatAttachmentPreview() {
  if (!state.chatFile) return '';
  return `<div class="chat-attachment-draft">${state.chatFile.type.startsWith('video/') ? `<video src="${state.chatPreview}" muted playsinline preload="metadata" aria-label="Selected video"></video>` : `<img src="${state.chatPreview}" alt="Selected photo">`}<div><strong>${e(state.chatFile.name)}</strong><small>${(state.chatFile.size / 1048576).toFixed(1)} MB · Ready to send</small></div><button type="button" class="icon-button" data-action="chat-attachment-remove" aria-label="Remove attachment">${icon('close')}</button></div>`;
}
export function chat() {
  const threads = state.data.chatThreads;
  if (!threads.some((thread) => thread.customerId === state.chatCustomerId))
    state.chatCustomerId = threads[0]?.customerId || '';
  const selected = threads.find((thread) => thread.customerId === state.chatCustomerId);
  const disabled = !selected || state.chatSending;
  return `${heading(isStaff() ? 'Customer messages' : 'Chat with Petopia')}
    <section class="panel chat-workspace ${isStaff() ? '' : 'customer-chat'}">
      ${isStaff() ? `<aside class="chat-inbox"><label class="search-field">${icon('search')}<input type="search" name="chatSearch" aria-label="Search conversations" placeholder="Find a customer…" value="${e(state.chatSearch)}"></label><div id="chat-threads">${threadList()}</div></aside>` : ''}
      <div class="chat-conversation">
        <div class="chat-conversation-header"><span class="icon-tile sage">${icon('chat')}</span><div><h2 id="chat-title">${e(isStaff() ? selected?.customerName || 'Choose a conversation' : 'Petopia care team')}</h2><small id="chat-connection">Messages refresh automatically while this page is open.</small></div>${selected && state.data.user.role !== 'staff' ? `<div class="chat-conversation-actions"><button type="button" class="btn btn-outline" data-action="chat-clear" aria-label="Delete conversation">${icon('trash')}<span>Delete chat</span></button></div>` : ''}</div>
        <div id="chat-messages" class="chat-messages" role="log" aria-live="polite" aria-label="Conversation">${chatMessages()}</div>
        <form data-form="chat" class="chat-composer">
          <div id="chat-attachment-preview">${chatAttachmentPreview()}</div>
          <label class="sr-only" for="chat-text">Your message</label><textarea id="chat-text" name="chatText" maxlength="2000" rows="2" placeholder="Write a message…" ${!selected ? 'disabled' : ''} ${state.chatSending ? 'readonly' : ''}>${e(state.chatDraft)}</textarea>
          <div class="chat-composer-actions"><label class="btn btn-outline chat-attach" for="chat-file">${icon('attach')}<span>Photo / video</span><input type="file" id="chat-file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" class="sr-only" ${disabled ? 'disabled' : ''}></label><button type="submit" class="btn btn-primary" ${disabled ? 'disabled' : ''}>${icon('send')}<span>${state.chatSending ? 'Sending…' : 'Send'}</span></button></div>
          <small>Photos and videos up to 25 MB · Enter to send</small>
        </form>
      </div>
    </section>`;
}
