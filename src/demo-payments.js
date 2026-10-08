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
      note: 'Sample visit for the presentation.',
      staffNote: '',
      createdAt: stamp,
    };
    db.appointments.push(visit);
    db.serviceRecords.push({
      id: id(),
      appointmentId: visit.id,
      petId: pet.id,
      petIds: [pet.id],
      notes: 'Demo care record. Service completed for this sample visit.',
      recordedAt: stamp,
      recordedBy: staff.id,
    });
    if (['Cash', 'GCash', 'Maya'].includes(method))
      db.payments.push({
        id: id(),
        appointmentId: visit.id,
        amount: service.basePrice,
        method,
        reference: `DEMO-${method.toUpperCase()}-${index + 1}`,
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
        reference: `DEMO-MAYA-REVIEW-${visit.id.slice(0, 8)}`,
        status: 'pending',
        submittedAt: stamp,
        reviewNote: '',
        wallet: { name: 'Petopia Demo Account', number: '09000000000' },
      });
  });
  for (const method of ['GCash', 'Maya']) {
    const wallet = db.wallets[method];
    if (!wallet.enabled && !wallet.name && !wallet.number)
      db.wallets[method] = {
        enabled: true,
        demo: true,
        name: 'Petopia Demo Account',
        number: '09000000000',
        instructions:
          'Demo only. Do not send money. Enter a sample reference to demonstrate staff verification.',
      };
  }
  db.demoPaymentsVersion = 1;
  return true;
}
module.exports = { prepareDemoPayments };
