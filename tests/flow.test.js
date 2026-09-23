const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server');

function nextSaturday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  const start = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  let days = (6 - start.getUTCDay() + 7) % 7;
  if (days === 0) days = 7; // Next Saturday, including when this test runs on Saturday.
  start.setUTCDate(start.getUTCDate() + days);
  return start.toISOString().slice(0, 10);
}

test('a customer request can be confirmed, completed and paid, with resource conflicts and data saved', async t => {
  fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
  const temp = fs.mkdtempSync(path.join(__dirname, '..', 'data', 'test-'));
  const dbFile = path.join(temp, 'db.json');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const { server } = await createApp({ dbFile });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let customerCookie = '', staffCookie = '', otherCookie = '';
  async function request(route, { method = 'GET', body, cookie = '' } = {}) {
    const response = await fetch(`${base}${route}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }

  const customer = await request('/api/auth/login', { method: 'POST', body: { email: 'alex@example.test', password: 'Petserve123!' } });
  assert.equal(customer.status, 200); customerCookie = customer.cookie;
  const staff = await request('/api/auth/login', { method: 'POST', body: { email: 'staff@petserve.test', password: 'Petserve123!' } });
  assert.equal(staff.status, 200); staffCookie = staff.cookie;
  const other = await request('/api/auth/register', { method: 'POST', body: { name: 'Sam Test', email: 'sam@example.test', password: 'MySecure123' } });
  assert.equal(other.status, 200); otherCookie = other.cookie;
  const createdPet = await request('/api/pets', { method: 'POST', cookie: otherCookie, body: { name: 'Nala', species: 'Cat', breed: 'Puspin' } });
  assert.equal(createdPet.status, 201);
  const customerData = await request('/api/bootstrap', { cookie: customerCookie });
  const petId = customerData.data.pets[0].id;
  const date = nextSaturday();
  const first = await request('/api/appointments', { method: 'POST', cookie: customerCookie, body: { petId, serviceId: 'grooming', date, time: '10:00' } });
  assert.equal(first.status, 201);
  const appointmentId = first.data.appointment.id;
  const duplicateOwn = await request('/api/appointments', { method: 'POST', cookie: customerCookie, body: { petId, serviceId: 'grooming', date, time: '10:00' } });
  assert.equal(duplicateOwn.status, 409);
  const second = await request('/api/appointments', { method: 'POST', cookie: otherCookie, body: { petId: createdPet.data.pet.id, serviceId: 'grooming', date, time: '10:00' } });
  assert.equal(second.status, 201); // Two requests can wait; only one can be confirmed.
  const staffQueue = await request('/api/bootstrap', { cookie: staffCookie });
  assert.equal(staffQueue.data.appointments.length, 2);
  const privateQueue = await request('/api/bootstrap', { cookie: otherCookie });
  assert.equal(privateQueue.data.appointments.length, 1);
  assert.equal(privateQueue.data.pets.length, 1);
  const stolenPet = await request('/api/appointments', { method: 'POST', cookie: otherCookie, body: { petId, serviceId: 'vaccination', date, time: '11:00' } });
  assert.equal(stolenPet.status, 400);
  const confirm = await request(`/api/appointments/${appointmentId}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'confirmed', staffNote: 'See you soon.' } });
  assert.equal(confirm.status, 200);
  const conflict = await request(`/api/appointments/${second.data.appointment.id}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'confirmed' } });
  assert.equal(conflict.status, 409);
  const secondPet = await request('/api/pets', { method: 'POST', cookie: otherCookie, body: { name: 'Sunny', species: 'Dog' } });
  assert.equal(secondPet.status, 201);
  const vetParallel = await request('/api/appointments', { method: 'POST', cookie: otherCookie, body: { petId: secondPet.data.pet.id, serviceId: 'vaccination', date, time: '10:00' } });
  assert.equal(vetParallel.status, 201); // A separate service team can use the same hour.
  const earlyPayment = await request(`/api/appointments/${appointmentId}/payment`, { method: 'POST', cookie: staffCookie, body: { amount: 450, method: 'Cash' } });
  assert.equal(earlyPayment.status, 409);
  const complete = await request(`/api/appointments/${appointmentId}/status`, { method: 'PATCH', cookie: staffCookie, body: { status: 'completed' } });
  assert.equal(complete.status, 200);
  const forbiddenPayment = await request(`/api/appointments/${appointmentId}/payment`, { method: 'POST', cookie: customerCookie, body: { amount: 450, method: 'Cash' } });
  assert.equal(forbiddenPayment.status, 403);
  const pay = await request(`/api/appointments/${appointmentId}/payment`, { method: 'POST', cookie: staffCookie, body: { amount: 450.50, method: 'Cash', reference: 'DEMO-001' } });
  assert.equal(pay.status, 201);
  assert.equal(pay.data.appointment.payment.amount, 45050);
  const doublePay = await request(`/api/appointments/${appointmentId}/payment`, { method: 'POST', cookie: staffCookie, body: { amount: 450.50, method: 'Cash' } });
  assert.equal(doublePay.status, 409);
  const customerReceipt = await request('/api/bootstrap', { cookie: customerCookie });
  assert.equal(customerReceipt.data.appointments[0].payment.reference, 'DEMO-001');
  const report = await request('/api/report', { cookie: staffCookie });
  assert.equal(report.data.amountCollected, 45050);

  const { server: restarted } = await createApp({ dbFile });
  await new Promise(resolve => restarted.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => restarted.close(resolve)));
  const again = await fetch(`http://127.0.0.1:${restarted.address().port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'staff@petserve.test', password: 'Petserve123!' }) });
  assert.equal(again.status, 200);
  const resumed = await fetch(`http://127.0.0.1:${restarted.address().port}/api/report`, { headers: { Cookie: again.headers.get('set-cookie').split(';')[0] } });
  assert.equal((await resumed.json()).amountCollected, 45050);
});
