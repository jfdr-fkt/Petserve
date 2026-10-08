const fs = require('node:fs');
const path = require('node:path');
const { send, requireUser } = require('../http');
const { clean, httpError } = require('../helpers');
const { newId, now } = require('../db');
const { chatMessage } = require('../chat');
const { FORMATS, matchesFormat, readUpload, mediaFile, serveMedia } = require('../media');

module.exports = async ({ req, res, pathname, url, db, user, persist, uploadsDir }) => {
  const route = /^\/api\/chat\/([a-f0-9-]+)\/(media|messages\/([a-f0-9-]+)(\/content)?)$/.exec(
    pathname,
  );
  if (!route) return false;
  requireUser(user);
  const customerId = route[1];
  if (user.role === 'customer' && customerId !== user.id)
    throw httpError(403, 'This conversation is private.');
  const customer = db.users.find(
    (account) => account.id === customerId && account.role === 'customer' && !account.disabled,
  );
  if (!customer) throw httpError(404, 'Customer conversation not found.');
  let thread = db.chats.find((item) => item.customerId === customerId);
  const directory = path.join(uploadsDir, 'chat');
  if (route[3]) {
    const message = thread?.messages.find((item) => item.id === route[3]);
    if (!message) throw httpError(404, 'Message not found.');
    if (route[4] && ['GET', 'HEAD'].includes(req.method)) {
      if (message.deletedAt || !message.attachment)
        throw httpError(404, 'Attachment no longer available.');
      serveMedia(req, res, mediaFile(directory, message.attachment), message.attachment.mime);
      return true;
    }
    if (!route[4] && req.method === 'DELETE') {
      if (message.senderId !== user.id && user.role !== 'admin')
        throw httpError(403, 'You can delete only your own messages.');
      if (!message.deletedAt) {
        const previous = { ...message };
        const file = message.attachment && mediaFile(directory, message.attachment);
        Object.assign(message, { text: '', attachment: null, deletedAt: now() });
        try {
          persist();
        } catch (error) {
          delete message.deletedAt;
          Object.assign(message, previous);
          throw error;
        }
        if (file && fs.existsSync(file)) fs.unlinkSync(file);
      }
      send(res, 200, { ok: true });
      return true;
    }
    return false;
  }
  if (req.method !== 'POST') return false;
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
    throw httpError(403, 'Cross-origin request blocked.');
  const mime = (req.headers['content-type'] || '').split(';')[0];
  if (!FORMATS[mime]) throw httpError(415, 'Choose a JPG, PNG, WebP, MP4 or WebM file.');
  const encoded = req.headers['x-message-caption'];
  if (encoded && (encoded.length > 8000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)))
    throw httpError(400, 'The attachment caption is invalid.');
  const text = encoded
    ? Buffer.from(encoded, 'base64').toString('utf8')
    : url.searchParams.get('text') || '';
  if (text.length > 2000) throw httpError(400, 'Write a caption up to 2,000 characters.');
  const buffer = await readUpload(req);
  if (!buffer.length || !matchesFormat(buffer, mime))
    throw httpError(400, 'The file contents do not match its image or video format.');
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
  const attachment = { filename: newId() + FORMATS[mime], mime, size: buffer.length };
  fs.mkdirSync(directory, { recursive: true });
  const file = mediaFile(directory, attachment);
  fs.writeFileSync(file, buffer, { flag: 'wx' });
  const readKey = user.role === 'customer' ? 'customerReadCount' : 'staffReadCount';
  const previousRead = thread[readKey];
  thread.messages.push({
    id: newId(),
    text: clean(text, 2000),
    attachment,
    senderId: user.id,
    senderName: user.name,
    role: user.role,
    createdAt: now(),
  });
  thread[readKey] = thread.messages.length;
  try {
    persist();
  } catch (error) {
    thread.messages.pop();
    thread[readKey] = previousRead;
    fs.unlinkSync(file);
    throw error;
  }
  send(res, 201, {
    customerId,
    customerName: customer.name,
    messages: thread.messages.map((message) => chatMessage(message, customerId, user)),
  });
  return true;
};
