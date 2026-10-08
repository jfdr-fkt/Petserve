import { state, isStaff } from '../state.js';
import { heading, icon, empty } from '../components.js';
import { escapeHTML as e } from '../utils.js';

export function threadList() {
  const threads = state.data.chatThreads.filter((t) =>
    t.customerName.toLowerCase().includes(state.chatSearch.toLowerCase()),
  );
  return threads.length
    ? threads
        .map(
          (t) =>
            `<button type="button" class="chat-thread ${t.customerId === state.chatCustomerId ? 'active' : ''}" data-action="chat-select" data-id="${t.customerId}"><span class="user-avatar">${e(t.customerName[0])}</span><span><strong>${e(t.customerName)}</strong><small>${e(t.lastMessage?.text || 'Start a conversation')}</small></span>${t.unread ? `<b class="chat-unread">${t.unread}</b>` : ''}</button>`,
        )
        .join('')
    : '<p class="panel-empty-note">No matching conversations.</p>';
}
export function chatMessages() {
  if (state.chatLoading && !state.chatMessages.length)
    return '<p class="panel-empty-note">Opening your conversation…</p>';
  return state.chatMessages.length
    ? state.chatMessages
        .map(
          (m) =>
            `<article class="chat-message ${isStaff() ? (m.role !== 'customer' ? 'outgoing' : '') : m.role === 'customer' ? 'outgoing' : ''}"><small>${e(m.senderName)}${m.role === 'customer' ? '' : ' · Care team'}</small><p>${e(m.text)}</p><time datetime="${m.createdAt}">${new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(m.createdAt))}</time></article>`,
        )
        .join('')
    : empty(
        'A friendly conversation starts here',
        'Ask about a visit, a payment, or your pet’s care. The team will reply when available.',
        '',
        'chat',
      );
}
export function chat() {
  const threads = state.data.chatThreads;
  if (!threads.some((t) => t.customerId === state.chatCustomerId))
    state.chatCustomerId = threads[0]?.customerId || '';
  const selected = threads.find((t) => t.customerId === state.chatCustomerId);
  return `${heading('A little conversation goes a long way', isStaff() ? 'Customer messages' : 'Chat with Petopia', 'Private conversations between pet owners and the care team.')}<section class="panel chat-workspace ${isStaff() ? '' : 'customer-chat'}">${isStaff() ? `<aside class="chat-inbox"><label class="search-field">${icon('search')}<input type="search" name="chatSearch" aria-label="Search conversations" placeholder="Find a customer…" value="${e(state.chatSearch)}"></label><div id="chat-threads">${threadList()}</div></aside>` : ''}<div class="chat-conversation"><div class="chat-conversation-header"><span class="icon-tile sage">${icon('chat')}</span><div><h2 id="chat-title">${e(isStaff() ? selected?.customerName || 'Choose a conversation' : 'Petopia care team')}</h2><small id="chat-connection">Messages refresh automatically while this page is open.</small></div></div><div id="chat-messages" class="chat-messages" role="log" aria-live="polite" aria-label="Conversation">${chatMessages()}</div><form data-form="chat" class="chat-composer"><label class="sr-only" for="chat-text">Your message</label><textarea id="chat-text" name="chatText" maxlength="2000" required rows="2" placeholder="Write a message…" ${!selected ? 'disabled' : ''}>${e(state.chatDraft)}</textarea><button type="submit" class="btn btn-primary" ${!selected ? 'disabled' : ''}>${icon('send')}<span>Send</span></button><small>Enter to send · Shift + Enter for a new line</small></form></div></section>`;
}
