const { send, readBody, requireUser, requireJson } = require('../http');
const { clean, httpError } = require('../helpers');
const { newId } = require('../db');

module.exports = async ({ req, res, pathname, db, user, sessions, token, persist }) => {
  const route = /^\/api\/staff(?:\/([a-f0-9-]+))?$/.exec(pathname);
  if (!route) return false;
  requireUser(user);
  if (!route[1] && req.method === 'GET') {
    send(res, 200, { staff: db.staffDirectory });
    return true;
  }
  requireUser(user, 'admin');
  if (
    (!route[1] && req.method !== 'POST') ||
    (route[1] && !['PATCH', 'DELETE'].includes(req.method))
  )
    throw httpError(405, 'Method not allowed.');
  requireJson(req);
  const data = await readBody(req);
  if (!db.users.includes(user) || user.disabled || sessions.get(token) !== user.id)
    throw httpError(403, 'Account access has changed. Sign in again.');
  requireUser(user, 'admin');
  const member = route[1] && db.staffDirectory.find((entry) => entry.id === route[1]);
  if (route[1] && !member) throw httpError(404, 'Staff member not found.');
  const previous = [...db.staffDirectory];
  if (req.method === 'DELETE') {
    if (data.confirm !== true) throw httpError(400, 'Confirm removal of this staff member.');
    db.staffDirectory = db.staffDirectory.filter((entry) => entry.id !== member.id);
  } else {
    for (const field of ['name', 'position'])
      if (
        typeof data[field] !== 'string' ||
        data[field].trim().length < 2 ||
        data[field].trim().length > 80
      )
        throw httpError(400, 'Enter a name and position of 2 to 80 characters.');
    const entry = {
      id: member ? member.id : newId(),
      name: clean(data.name, 80),
      position: clean(data.position, 80),
    };
    if (member) db.staffDirectory[db.staffDirectory.indexOf(member)] = entry;
    else db.staffDirectory.push(entry);
  }
  try {
    persist();
  } catch (error) {
    db.staffDirectory = previous;
    throw error;
  }
  send(res, req.method === 'POST' ? 201 : 200, { ok: true });
  return true;
};
