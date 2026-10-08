const { send, readBody, requireUser, requireJson } = require('../http');
const { clean, httpError } = require('../helpers');
const { newId, now, appointmentView } = require('../db');

module.exports = async ({ req, res, pathname, db, user, persist }) => {
  if (pathname === '/api/payment-settings' && req.method === 'PATCH') {
    requireUser(user, ['staff', 'admin']);
    requireJson(req);
    const data = await readBody(req);
    const wallets = {};
    for (const method of ['GCash', 'Maya']) {
      const wallet = data[method];
      if (!wallet || typeof wallet.enabled !== 'boolean')
        throw httpError(400, 'Set up both wallet options.');
      const name = clean(wallet.name, 80),
        number = clean(wallet.number, 30),
        instructions = clean(wallet.instructions, 300);
      if (wallet.enabled && (!name || !/^09\d{9}$/.test(number)))
        throw httpError(
          400,
          `Add the ${method} account name and an 11-digit mobile number starting with 09.`,
        );
      wallets[method] = { enabled: wallet.enabled, name, number, instructions };
    }
    db.wallets = wallets;
    persist();
    send(res, 200, { wallets });
    return true;
  }
  const submit = /^\/api\/appointments\/([a-f0-9-]+)\/online-payment$/.exec(pathname);
  if (submit && req.method === 'POST') {
    requireUser(user, 'customer');
    requireJson(req);
    const visit = db.appointments.find((a) => a.id === submit[1] && a.customerId === user.id);
    if (!visit) throw httpError(404, 'Visit not found.');
    if (visit.status !== 'completed' || db.payments.some((p) => p.appointmentId === visit.id))
      throw httpError(409, 'Online transfers are available for unpaid completed visits.');
    if (db.paymentRequests.some((r) => r.appointmentId === visit.id && r.status === 'pending'))
      throw httpError(409, 'Your transfer is already awaiting verification.');
    const data = await readBody(req),
      amount = Number(data.amount),
      reference = clean(data.reference, 60);
    if (!['GCash', 'Maya'].includes(data.method) || !db.wallets[data.method]?.enabled)
      throw httpError(400, 'Choose an available wallet.');
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1000000 ||
      Math.round(amount * 100) / 100 !== amount ||
      !/^[a-zA-Z0-9-]{6,60}$/.test(reference)
    )
      throw httpError(
        400,
        'Enter the amount sent and a valid transaction reference (6–60 letters, numbers, or hyphens).',
      );
    if (
      db.paymentRequests.some(
        (r) =>
          r.method === data.method &&
          r.reference.toLowerCase() === reference.toLowerCase() &&
          r.status !== 'rejected',
      )
    )
      throw httpError(409, 'This transaction reference has already been submitted.');
    db.paymentRequests.push({
      id: newId(),
      appointmentId: visit.id,
      customerId: user.id,
      method: data.method,
      amount: Math.round(amount * 100),
      reference,
      status: 'pending',
      submittedAt: now(),
      reviewNote: '',
      wallet: { name: db.wallets[data.method].name, number: db.wallets[data.method].number },
    });
    persist();
    send(res, 201, { appointment: appointmentView(db, visit) });
    return true;
  }
  const review = /^\/api\/payment-requests\/([a-f0-9-]+)$/.exec(pathname);
  if (review && req.method === 'PATCH') {
    requireUser(user, ['staff', 'admin']);
    requireJson(req);
    const item = db.paymentRequests.find((r) => r.id === review[1]);
    if (!item) throw httpError(404, 'Transfer not found.');
    if (item.status !== 'pending') throw httpError(409, 'This transfer has already been reviewed.');
    const data = await readBody(req),
      note = clean(data.note, 300);
    if (!['verified', 'rejected'].includes(data.status) || (data.status === 'rejected' && !note))
      throw httpError(400, 'Choose a review result and explain a rejected transfer.');
    const visit = db.appointments.find((a) => a.id === item.appointmentId);
    if (
      !visit ||
      visit.status !== 'completed' ||
      db.payments.some((p) => p.appointmentId === visit.id)
    )
      throw httpError(409, 'This visit already has a payment or is not complete.');
    if (data.status === 'verified') {
      if (data.received !== true)
        throw httpError(400, 'Confirm the transfer was received in the shop’s wallet.');
      db.payments.push({
        id: newId(),
        appointmentId: visit.id,
        amount: item.amount,
        method: item.method,
        reference: item.reference,
        recordedAt: now(),
        recordedBy: user.id,
        source: 'online-transfer',
      });
    }
    Object.assign(item, {
      status: data.status,
      reviewNote: note,
      reviewedAt: now(),
      reviewedBy: user.id,
    });
    persist();
    send(res, 200, { appointment: appointmentView(db, visit) });
    return true;
  }
  return false;
};
