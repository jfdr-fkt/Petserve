const crypto = require('node:crypto');
const { send, readBody, requireUser, requireJson } = require('../http');
const { hashPassword, verifyPassword, PUBLIC_USER, newId } = require('../db');
const { clean, httpError } = require('../helpers');

module.exports = async ({ req, res, pathname, db, user, sessions, persist, token }) => {
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    requireJson(req);
    sessions.delete(token);
    send(
      res,
      200,
      { ok: true },
      { 'Set-Cookie': 'petserve_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' },
    );
    return true;
  }
  if (req.method === 'POST' && ['/api/auth/login', '/api/auth/register'].includes(pathname)) {
    requireJson(req);
    const data = await readBody(req);
    const email = clean(data.email, 160).toLowerCase();
    const password = typeof data.password === 'string' ? data.password : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw httpError(400, 'Enter a valid email address.');
    let account;
    if (pathname.endsWith('register')) {
      const name = clean(data.name, 80);
      if (name.length < 2 || password.length < 8 || password.length > 128)
        throw httpError(400, 'Enter your name and a password of 8 to 128 characters.');
      if (db.users.some((u) => u.email === email))
        throw httpError(409, 'This email is already registered.');
      const passwordHash = await hashPassword(password);
      if (db.users.some((u) => u.email === email))
        throw httpError(409, 'This email is already registered.');
      account = {
        id: newId(),
        name,
        email,
        role: 'customer',
        passwordHash,
        phone: clean(data.phone, 30),
      };
      db.users.push(account);
      persist();
    } else {
      account = db.users.find((u) => u.email === email);
      if (
        !account ||
        account.disabled ||
        password.length > 128 ||
        !(await verifyPassword(password, account.passwordHash))
      )
        throw httpError(401, 'Email or password is incorrect, or the account is inactive.');
    }
    const nextToken = crypto.randomBytes(32).toString('hex');
    if (token) sessions.delete(token);
    sessions.set(nextToken, account.id);
    send(
      res,
      200,
      { user: PUBLIC_USER(account) },
      { 'Set-Cookie': `petserve_session=${nextToken}; HttpOnly; SameSite=Lax; Path=/` },
    );
    return true;
  }
  if (req.method === 'PATCH' && pathname === '/api/account') {
    requireUser(user);
    requireJson(req);
    const data = await readBody(req),
      name = clean(data.name, 80);
    if (name.length < 2) throw httpError(400, 'Enter your full name.');
    user.name = name;
    user.phone = clean(data.phone, 30);
    persist();
    send(res, 200, { user: PUBLIC_USER(user) });
    return true;
  }
  const match = /^\/api\/users\/([a-f0-9-]+)$/.exec(pathname);
  if (match && req.method === 'PATCH') {
    requireUser(user, 'admin');
    requireJson(req);
    const account = db.users.find((u) => u.id === match[1]);
    if (!account) throw httpError(404, 'Account not found.');
    const data = await readBody(req);
    if (!['customer', 'staff', 'admin'].includes(data.role) || typeof data.disabled !== 'boolean')
      throw httpError(400, 'Choose a valid role and account status.');
    if (account.id === user.id && (data.role !== 'admin' || data.disabled))
      throw httpError(409, 'Keep your own administrator account active.');
    if (
      account.role === 'admin' &&
      (data.role !== 'admin' || data.disabled) &&
      db.users.filter((u) => u.role === 'admin' && !u.disabled).length <= 1
    )
      throw httpError(409, 'At least one active administrator is required.');
    account.role = data.role;
    account.disabled = data.disabled;
    for (const [session, id] of sessions)
      if (id === account.id && id !== user.id) sessions.delete(session);
    persist();
    send(res, 200, { user: PUBLIC_USER(account) });
    return true;
  }
  return false;
};
