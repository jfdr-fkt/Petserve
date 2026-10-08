const { send, readBody, requireUser, requireJson } = require('../http');
const { clean, httpError } = require('../helpers');
const { newId, now } = require('../db');
const { chatThreads, chatMessage } = require('../chat');

module.exports = async ({ req, res, pathname, db, user, persist }) => {
  if (pathname === '/api/chat' && req.method === 'GET') {
    requireUser(user);
    send(res, 200, { threads: chatThreads(db, user) });
    return true;
  }
  const route = /^\/api\/chat\/([a-f0-9-]+)$/.exec(pathname);
  if (!route || !['GET', 'POST'].includes(req.method)) return false;
  requireUser(user);
  const customerId = route[1];
  if (user.role === 'customer' && customerId !== user.id)
    throw httpError(403, 'This conversation is private.');
  const customer = db.users.find(
    (u) => u.id === customerId && u.role === 'customer' && !u.disabled,
  );
  if (!customer) throw httpError(404, 'Customer conversation not found.');
  let thread = db.chats.find((t) => t.customerId === customerId);
  const readKey = user.role === 'customer' ? 'customerReadCount' : 'staffReadCount';
  if (req.method === 'POST') {
    requireJson(req);
    const data = await readBody(req);
    if (typeof data.text !== 'string' || !clean(data.text, 2000) || data.text.length > 2000)
      throw httpError(400, 'Write a message up to 2,000 characters.');
    if (
      !db.users.includes(user) ||
      user.disabled ||
      !db.users.includes(customer) ||
      customer.disabled ||
      customer.role !== 'customer'
    )
      throw httpError(403, 'This conversation is no longer available.');
    thread = db.chats.find((item) => item.customerId === customerId);
    if (!thread) {
      thread = { id: newId(), customerId, messages: [], customerReadCount: 0, staffReadCount: 0 };
      db.chats.push(thread);
    }
    thread.messages.push({
      id: newId(),
      text: clean(data.text, 2000),
      senderId: user.id,
      senderName: user.name,
      role: user.role,
      createdAt: now(),
    });
    thread[readKey] = thread.messages.length;
    persist();
  } else if (thread && thread[readKey] !== thread.messages.length) {
    thread[readKey] = thread.messages.length;
    persist();
  }
  send(res, req.method === 'POST' ? 201 : 200, {
    customerId,
    customerName: customer.name,
    messages: (thread?.messages || []).map((message) => chatMessage(message, customerId, user)),
  });
  return true;
};
