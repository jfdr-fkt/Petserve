const fs = require('node:fs');
const path = require('node:path');
const { send, readBody, requireUser, requireJson } = require('../http');
const { httpError } = require('../helpers');
const { mediaFile } = require('../media');

module.exports = async ({ req, res, pathname, db, user, persist, uploadsDir }) => {
  const match = /^\/api\/chat\/([a-f0-9-]+)$/.exec(pathname);
  if (!match || req.method !== 'DELETE') return false;
  requireUser(user);
  requireJson(req);
  const body = await readBody(req);
  if (!db.users.includes(user) || user.disabled)
    throw httpError(403, 'Sign in again to manage this conversation.');
  if (user.role !== 'admin' && !(user.role === 'customer' && match[1] === user.id))
    throw httpError(403, 'Only the conversation owner or an administrator can delete it.');
  if (body.confirm !== true) throw httpError(400, 'Confirm deletion of the whole conversation.');
  const index = db.chats.findIndex((thread) => thread.customerId === match[1]);
  if (index >= 0) {
    const thread = db.chats[index];
    const files = thread.messages
      .filter((message) => message.attachment)
      .map((message) => mediaFile(path.join(uploadsDir, 'chat'), message.attachment));
    db.chats.splice(index, 1);
    try {
      persist();
    } catch (error) {
      db.chats.splice(index, 0, thread);
      throw error;
    }
    for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  send(res, 200, { ok: true });
  return true;
};
