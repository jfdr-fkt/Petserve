const { send, readBody, requireUser, requireJson } = require('../http');
const { clean, httpError } = require('../helpers');
const { hashPassword, verifyPassword } = require('../db');
const { passwordFields, issueReset, resetAccount, revokeSessions } = require('../account-security');

module.exports = async ({ req, res, pathname, db, user, sessions, persist, token }) => {
  const adminReset = /^\/api\/users\/([a-f0-9-]+)\/password-reset$/.exec(pathname);
  if (req.method === 'POST' && (pathname === '/api/auth/forgot-password' || adminReset)) {
    if (adminReset) requireUser(user, 'admin');
    requireJson(req);
    const data = await readBody(req);
    if (adminReset && (!db.users.includes(user) || user.disabled || user.role !== 'admin'))
      throw httpError(403, 'Administrator access has changed. Sign in again.');
    const email = clean(data.email, 160).toLowerCase();
    if (!adminReset && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw httpError(400, 'Enter a valid email address.');
    const account = db.users.find(
      (item) => !item.disabled && (adminReset ? item.id === adminReset[1] : item.email === email),
    );
    if (adminReset && !account) throw httpError(404, 'Active account not found.');
    let resetPath;
    if (account && (adminReset || account.demo)) {
      const previous = account.passwordReset;
      resetPath = issueReset(account);
      try {
        persist();
      } catch (error) {
        if (previous) account.passwordReset = previous;
        else delete account.passwordReset;
        throw error;
      }
    }
    send(res, 200, {
      ok: true,
      message:
        'If the account is eligible, a password reset link is ready. For other accounts, contact the clinic for recovery.',
      ...(resetPath ? { resetPath, expiresInMinutes: 20 } : {}),
    });
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/auth/reset-password') {
    requireJson(req);
    const data = await readBody(req),
      password = passwordFields(data);
    const account = resetAccount(db, data.token);
    if (!account) throw httpError(400, 'This reset link is invalid or expired. Request a new one.');
    const reset = account.passwordReset,
      previousHash = account.passwordHash;
    const nextHash = await hashPassword(password);
    if (
      !db.users.includes(account) ||
      resetAccount(db, data.token) !== account ||
      account.passwordReset !== reset ||
      account.passwordHash !== previousHash
    )
      throw httpError(409, 'This reset link is no longer valid. Request a new one.');
    account.passwordHash = nextHash;
    delete account.passwordReset;
    try {
      persist();
    } catch (error) {
      account.passwordHash = previousHash;
      account.passwordReset = reset;
      throw error;
    }
    revokeSessions(sessions, account.id);
    send(
      res,
      200,
      { ok: true },
      { 'Set-Cookie': 'petserve_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' },
    );
    return true;
  }
  if (req.method !== 'PATCH' || pathname !== '/api/account/password') return false;
  requireUser(user);
  requireJson(req);
  const data = await readBody(req),
    password = passwordFields(data);
  const previousHash = user.passwordHash;
  if (
    typeof data.currentPassword !== 'string' ||
    data.currentPassword.length > 128 ||
    !(await verifyPassword(data.currentPassword, previousHash))
  )
    throw httpError(403, 'Your current password is incorrect.');
  if (password === data.currentPassword) throw httpError(400, 'Choose a different new password.');
  const nextHash = await hashPassword(password);
  if (!db.users.includes(user) || user.disabled || user.passwordHash !== previousHash)
    throw httpError(409, 'Account access has changed. Sign in again.');
  const previousReset = user.passwordReset;
  user.passwordHash = nextHash;
  delete user.passwordReset;
  try {
    persist();
  } catch (error) {
    user.passwordHash = previousHash;
    if (previousReset) user.passwordReset = previousReset;
    throw error;
  }
  revokeSessions(sessions, user.id, token);
  send(res, 200, { ok: true });
  return true;
};
