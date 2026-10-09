const crypto = require('node:crypto');
const { manilaNow } = require('./helpers');

function prepareDemoPayments(db) {
  if (db.demoPaymentsVersion >= 1) return false;
  const customer = db.users.find(
    (user) => user.demo && user.email === 'alex@example.test' && !user.disabled,
  );
  const pet = customer && db.pets.find((item) => item.ownerId === customer.id && !item.deletedAt);
  const staff = db.users.find((user) => user.role === 'staff' && !user.disabled);
  if (!pet || !staff) return false;
  const id = () => crypto.randomUUID();
  const current = new Date(`${manilaNow().date}T12:00:00Z`);
  current.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 1) % 7 || 7));
  const fixtures = [
    ['grooming', 'Cash'],
    ['vaccination', 'GCash'],
    ['deworming', 'Maya'],
    ['consultation', 'pending'],
    ['grooming', 'unpaid'],
  ];
  fixtures.forEach(([serviceId, method], index) => {
    const service = db.services.find((item) => item.id === serviceId);
    if (!service) return;
    const date = new Date(current);
    date.setUTCDate(date.getUTCDate() - index * 7);
    const visitDate = date.toISOString().slice(0, 10),
      stamp = `${visitDate}T04:00:00.000Z`;
    const visit = {
      id: id(),
      demo: true,
      customerId: customer.id,
      petId: pet.id,
      petIds: [pet.id],
      serviceId,
      serviceName: service.name,
      basePrice: service.basePrice,
      unitPrice: service.basePrice,
      duration: service.duration,
      resource: service.resource,
      date: visitDate,
      time: '09:00',
      status: 'completed',
      note: '',
      staffNote: '',
      createdAt: stamp,
    };
    db.appointments.push(visit);
    db.serviceRecords.push({
      id: id(),
      appointmentId: visit.id,
      petId: pet.id,
      petIds: [pet.id],
      notes: 'Service completed.',
      recordedAt: stamp,
      recordedBy: staff.id,
    });
    if (['Cash', 'GCash', 'Maya'].includes(method))
      db.payments.push({
        id: id(),
        appointmentId: visit.id,
        amount: service.basePrice,
        method,
        reference: `${method.toUpperCase()}-${visit.id.slice(0, 8).toUpperCase()}`,
        recordedAt: stamp,
        recordedBy: staff.id,
      });
    if (method === 'pending')
      db.paymentRequests.push({
        id: id(),
        appointmentId: visit.id,
        customerId: customer.id,
        method: 'Maya',
        amount: service.basePrice,
        reference: `MAYA-${visit.id.slice(0, 8).toUpperCase()}`,
        status: 'pending',
        submittedAt: stamp,
        reviewNote: '',
        wallet: { name: 'Petopia Pet Care Services', number: '09000000000' },
      });
  });
  for (const method of ['GCash', 'Maya']) {
    const wallet = db.wallets[method];
    if (!wallet.enabled && !wallet.name && !wallet.number)
      db.wallets[method] = {
        enabled: true,
        demo: true,
        name: 'Petopia Pet Care Services',
        number: '09000000000',
        instructions: '',
      };
  }
  db.demoPaymentsVersion = 1;
  return true;
}
function refreshPresentationCopy(db) {
  for (const wallet of Object.values(db.wallets)) {
    if (!wallet.demo) continue;
    if (wallet.name === 'Petopia Demo Account') wallet.name = 'Petopia Pet Care Services';
    if (
      wallet.instructions ===
      'Demo only. Do not send money. Enter a sample reference to demonstrate staff verification.'
    )
      wallet.instructions = '';
  }
  const visits = new Map(
    db.appointments.filter((visit) => visit.demo).map((visit) => [visit.id, visit]),
  );
  for (const visit of visits.values())
    if (visit.note === 'Sample visit for the presentation.') visit.note = '';
  for (const record of db.serviceRecords)
    if (
      visits.has(record.appointmentId) &&
      record.notes === 'Demo care record. Service completed for this sample visit.'
    )
      record.notes = 'Service completed.';
  for (const payment of db.payments)
    if (
      visits.has(payment.appointmentId) &&
      /^DEMO-(CASH|GCASH|MAYA)-[1-3]$/.test(payment.reference)
    )
      payment.reference = `${payment.method.toUpperCase()}-${payment.appointmentId.slice(0, 8).toUpperCase()}`;
  for (const transfer of db.paymentRequests) {
    if (!visits.has(transfer.appointmentId)) continue;
    if (transfer.reference === `DEMO-MAYA-REVIEW-${transfer.appointmentId.slice(0, 8)}`)
      transfer.reference = `MAYA-${transfer.appointmentId.slice(0, 8).toUpperCase()}`;
    if (transfer.wallet?.name === 'Petopia Demo Account')
      transfer.wallet.name = 'Petopia Pet Care Services';
  }
}
module.exports = { prepareDemoPayments, refreshPresentationCopy };
