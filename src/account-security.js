const crypto = require('node:crypto');
const { httpError } = require('./helpers');

function passwordFields(data) {
  const password = data.newPassword;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    throw httpError(400, 'Choose a password of 8 to 128 characters.');
  if (password !== data.confirmPassword) throw httpError(400, 'The new passwords do not match.');
  return password;
}
const isDemoEmail = (email) =>
  /@(?:[^@]+\.)?(?:test|invalid|example)$|@example\.(?:com|net|org)$/i.test(email);
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
function issueReset(account) {
  const token = crypto.randomBytes(32).toString('hex');
  account.passwordReset = { digest: digest(token), expiresAt: Date.now() + 20 * 60 * 1000 };
  return `/#reset-password/${token}`;
}
function resetAccount(db, token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const hash = digest(token);
  return db.users.find(
    (account) =>
      !account.disabled &&
      account.passwordReset?.digest === hash &&
      account.passwordReset.expiresAt > Date.now(),
  );
}
function revokeSessions(sessions, accountId, keep = '') {
  for (const [key, id] of sessions) if (id === accountId && key !== keep) sessions.delete(key);
}
module.exports = { passwordFields, isDemoEmail, issueReset, resetAccount, revokeSessions };
