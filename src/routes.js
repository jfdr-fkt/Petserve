const { send, serveStatic } = require('./http');
const { PUBLIC_USER, appointmentView } = require('./db');
const { httpError } = require('./helpers');
const { chatThreads } = require('./chat');
const handlers = [
  require('./routes/accounts'),
  require('./routes/staff'),
  require('./routes/account-security'),
  require('./routes/chat-deletion'),
  require('./routes/account-deletion'),
  require('./routes/pets'),
  require('./routes/pet-media'),
  require('./routes/appointments'),
  require('./routes/care-plans'),
  require('./routes/clinic'),
  require('./routes/shifts'),
  require('./routes/community'),
  require('./routes/transfers'),
  require('./routes/chat'),
  require('./routes/chat-media'),
];

function createHandler(db, sessions, persist, uploadsDir) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https: blob:; media-src 'self' blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'",
    );
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;
      if (!pathname.startsWith('/api/')) {
        if (req.method !== 'GET') throw httpError(405, 'Method not allowed.');
        return serveStatic(res, pathname, req);
      }
      const token = /(?:^|;\s*)petserve_session=([a-f0-9]{64})(?:;|$)/.exec(
        req.headers.cookie || '',
      )?.[1];
      const user = db.users.find((u) => u.id === sessions.get(token) && !u.disabled) || null;
      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        const staff = user && ['staff', 'admin'].includes(user.role);
        const pets = user
          ? db.pets
              .filter((p) => !p.deletedAt && (staff || p.ownerId === user.id))
              .map((p) => ({
                ...p,
                ownerName: db.users.find((u) => u.id === p.ownerId)?.name || 'Customer',
              }))
          : [];
        const petIds = new Set(pets.map((p) => p.id));
        return send(res, 200, {
          user: user ? PUBLIC_USER(user) : null,
          staffDirectory: user ? db.staffDirectory : [],
          services: db.services,
          timeSlots: db.schedule.timeSlots,
          schedule: user ? db.schedule : null,
          shifts:
            user?.role === 'admin'
              ? db.shifts
              : user?.role === 'staff'
                ? db.shifts.filter((shift) => shift.employeeId === user.id)
                : [],
          pets,
          petMedia: user
            ? db.petMedia
                .filter((item) => petIds.has(item.petId))
                .map(({ filename, ...item }) => ({
                  ...item,
                  url: `/api/pets/${item.petId}/media/${item.id}/content`,
                }))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            : [],
          healthLogs: db.healthLogs.filter((h) => petIds.has(h.petId)),
          appointments: user
            ? db.appointments
                .filter((a) => staff || a.customerId === user.id)
                .map((a) => appointmentView(db, a))
                .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
            : [],
          users: user?.role === 'admin' ? db.users.map(PUBLIC_USER) : [],
          wallets: user ? db.wallets : {},
          chatThreads: user ? chatThreads(db, user) : [],
          feedback: user
            ? db.feedback
                .filter((f) => staff || f.customerId === user.id)
                .map((f) => ({
                  ...f,
                  customerName: staff
                    ? db.users.find((u) => u.id === f.customerId)?.name || 'Customer'
                    : user.name,
                }))
            : [],
          gallery: user
            ? db.gallery
                .map(({ filename, uploadedBy, ...item }) => ({
                  ...item,
                  url: `/api/gallery/${item.id}/content`,
                  serviceName:
                    db.services.find((s) => s.id === item.serviceId)?.name || 'Life at Petopia',
                }))
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            : [],
        });
      }
      const context = { req, res, pathname, url, db, sessions, persist, token, user, uploadsDir };
      for (const handler of handlers) if (await handler(context)) return;
      throw httpError(404, 'Page not found.');
    } catch (error) {
      if (!res.writableEnded && !res.destroyed)
        send(res, error.status || 500, {
          error: error.status ? error.message : 'Unexpected server error.',
        });
      if (!error.status) console.error(error);
    }
  };
}
module.exports = { createHandler };
