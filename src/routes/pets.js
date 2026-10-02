const { send, readBody, requireUser, requireJson } = require('../http');
const { newId, now } = require('../db');
const { clean, validDate, manilaNow, httpError } = require('../helpers');

function fields(data) {
  const name = clean(data.name, 80),
    species = clean(data.species, 40);
  if (!name || !['Dog', 'Cat', 'Other'].includes(species))
    throw httpError(400, 'Enter a pet name and species.');
  const photoUrl = typeof data.photoUrl === 'string' ? data.photoUrl : '';
  if (
    photoUrl.length > 2000000 ||
    (photoUrl && !/^(data:image\/(png|jpeg|webp);base64,|https:\/\/)/.test(photoUrl))
  )
    throw httpError(400, 'Use a JPG, PNG or WebP photo.');
  if (data.birthDate && (!validDate(data.birthDate) || data.birthDate > manilaNow().date))
    throw httpError(400, 'Enter a valid past birth date.');
  const weight = data.weight === '' || data.weight == null ? '' : Number(data.weight);
  if (weight !== '' && (!Number.isFinite(weight) || weight <= 0 || weight > 300))
    throw httpError(400, 'Enter a weight between 0 and 300 kg.');
  return {
    name,
    species,
    breed: clean(data.breed, 80),
    age: clean(data.age, 40),
    notes: clean(data.notes, 300),
    photoUrl,
    birthDate: data.birthDate || '',
    weight,
    sex: ['Male', 'Female'].includes(data.sex) ? data.sex : '',
    allergies: clean(data.allergies, 200),
  };
}

module.exports = async ({ req, res, pathname, db, user, persist }) => {
  if (pathname === '/api/pets' && req.method === 'POST') {
    requireUser(user, 'customer');
    requireJson(req);
    const data = fields(await readBody(req));
    if (db.pets.filter((p) => p.ownerId === user.id && !p.deletedAt).length >= 25)
      throw httpError(400, 'Pet profile limit reached.');
    const pet = { id: newId(), ownerId: user.id, ...data, createdAt: now() };
    db.pets.push(pet);
    persist();
    send(res, 201, { pet });
    return true;
  }
  const match = /^\/api\/pets\/([a-f0-9-]+)(\/health-logs)?$/.exec(pathname);
  if (!match || !['PATCH', 'DELETE', 'POST'].includes(req.method)) return false;
  requireUser(user);
  const pet = db.pets.find((p) => p.id === match[1] && !p.deletedAt);
  if (!pet) throw httpError(404, 'Pet profile not found.');
  if (user.role === 'customer' && pet.ownerId !== user.id) throw httpError(403, 'Access denied.');
  if (!match[2] && req.method === 'PATCH') {
    requireJson(req);
    Object.assign(pet, fields({ ...pet, ...(await readBody(req)) }));
    persist();
    send(res, 200, { pet });
    return true;
  }
  if (!match[2] && req.method === 'DELETE') {
    requireUser(user, 'customer');
    if (
      db.appointments.some((a) => a.petId === pet.id && ['pending', 'confirmed'].includes(a.status))
    )
      throw httpError(409, 'Cancel or complete this pet’s upcoming visits before archiving.');
    pet.deletedAt = now();
    persist();
    send(res, 200, { ok: true });
    return true;
  }
  if (match[2] && req.method === 'POST') {
    requireJson(req);
    const data = await readBody(req),
      date = data.date || manilaNow().date;
    if (
      !clean(data.title, 100) ||
      !['vaccine', 'medical', 'deworming'].includes(data.type) ||
      !validDate(date) ||
      date > manilaNow().date
    )
      throw httpError(400, 'Enter a record title, type and valid past date.');
    if (data.dueDate && (!validDate(data.dueDate) || data.dueDate < date))
      throw httpError(400, 'The follow-up date must be on or after the record date.');
    const healthLog = {
      id: newId(),
      petId: pet.id,
      title: clean(data.title, 100),
      type: data.type,
      date,
      dueDate: data.dueDate || '',
      notes: clean(data.notes, 300),
      source: user.role === 'customer' ? 'Owner provided' : 'Clinic record',
      createdAt: now(),
    };
    db.healthLogs.push(healthLog);
    persist();
    send(res, 201, { healthLog });
    return true;
  }
  return false;
};
