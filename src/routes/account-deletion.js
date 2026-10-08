const fs = require('node:fs');
const path = require('node:path');
const { send, readBody, requireUser, requireJson } = require('../http');
const { verifyPassword, now } = require('../db');
const { httpError } = require('../helpers');
const { mediaFile } = require('../media');

module.exports = async ({ req, res, pathname, db, user, sessions, persist, uploadsDir }) => {
  if (req.method !== 'DELETE') return false;
  const target = /^\/api\/users\/([a-f0-9-]+)$/.exec(pathname);
  if (pathname !== '/api/account' && !target) return false;
  requireUser(user, target ? 'admin' : undefined);
  requireJson(req);
  const account = target ? db.users.find((item) => item.id === target[1]) : user;
  if (!account) throw httpError(404, 'Account not found.');
  const body = await readBody(req);
  if (body.confirm !== true)
    throw httpError(400, 'Confirm that you want to permanently delete this account.');
  if (
    typeof body.password !== 'string' ||
    body.password.length > 128 ||
    !(await verifyPassword(body.password, user.passwordHash))
  )
    throw httpError(403, 'Enter your current password to delete the account.');
  if (!db.users.includes(user) || user.disabled || !db.users.includes(account))
    throw httpError(403, 'Account access has changed. Sign in again.');
  requireUser(user, target ? 'admin' : undefined);
  if (
    account.role === 'admin' &&
    !account.disabled &&
    db.users.filter((item) => item.role === 'admin' && !item.disabled).length <= 1
  )
    throw httpError(409, 'Create another active administrator before removing this account.');
  const before = structuredClone(db);
  const stamp = now();
  const files = [];
  db.users = db.users.filter((item) => item.id !== account.id);
  db.shifts = db.shifts.filter((shift) => shift.employeeId !== account.id);
  for (const pet of db.pets.filter((item) => item.ownerId === account.id)) {
    pet.deletedAt ||= stamp;
    pet.photoUrl = '';
  }
  for (const visit of db.appointments.filter(
    (item) => item.customerId === account.id && ['pending', 'confirmed'].includes(item.status),
  )) {
    visit.status = 'cancelled';
    visit.staffNote = 'Account closed.';
  }
  db.feedback = db.feedback.filter((item) => item.customerId !== account.id);
  for (const item of db.gallery.filter((item) => item.uploadedBy === account.id))
    files.push(mediaFile(uploadsDir, item));
  db.gallery = db.gallery.filter((item) => item.uploadedBy !== account.id);
  for (const thread of db.chats) {
    for (const message of thread.messages) {
      if (thread.customerId !== account.id && message.senderId !== account.id) continue;
      if (message.attachment)
        files.push(mediaFile(path.join(uploadsDir, 'chat'), message.attachment));
      Object.assign(message, {
        text: '',
        attachment: null,
        senderName: 'Deleted account',
        deletedAt: stamp,
      });
    }
  }
  db.chats = db.chats.filter((thread) => thread.customerId !== account.id);
  try {
    persist();
  } catch (error) {
    Object.assign(db, before);
    throw error;
  }
  for (const [key, id] of sessions) if (id === account.id) sessions.delete(key);
  for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file);
  const self = account.id === user.id;
  send(
    res,
    200,
    { ok: true, signedOut: self },
    self ? { 'Set-Cookie': 'petserve_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' } : {},
  );
  return true;
};
