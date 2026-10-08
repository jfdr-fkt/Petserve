const { httpError } = require('./helpers');
const { assertSlot, assertPetFree } = require('./scheduling');

function selectCarePlan(db, user, items) {
  if (!Array.isArray(items) || !items.length || items.length > 30)
    throw httpError(400, 'Select between one and thirty pets for this care request.');
  const ids = new Set();
  const selected = items.map((item) => {
    if (!item || ids.has(item.petId)) throw httpError(400, 'Select each pet only once.');
    ids.add(item.petId);
    const pet = db.pets.find(
      (entry) => entry.id === item.petId && entry.ownerId === user.id && !entry.deletedAt,
    );
    if (!pet) throw httpError(400, 'Choose active pets from your own profiles.');
    if (
      !Array.isArray(item.serviceIds) ||
      !item.serviceIds.length ||
      item.serviceIds.length > db.services.length ||
      new Set(item.serviceIds).size !== item.serviceIds.length
    )
      throw httpError(400, `Choose at least one different service for ${pet.name}.`);
    const services = item.serviceIds.map((id) =>
      db.services.find((entry) => entry.id === id && entry.active),
    );
    if (services.some((entry) => !entry))
      throw httpError(400, 'Choose available services from the care menu.');
    return { pet, services };
  });
  return db.services.flatMap((service) => {
    const pets = selected
      .filter((entry) => entry.services.includes(service))
      .map((entry) => entry.pet);
    const size = service.id === 'consultation' ? 6 : 1;
    return Array.from({ length: Math.ceil(pets.length / size) }, (_, index) => ({
      service: { ...service },
      pets: pets.slice(index * size, (index + 1) * size),
    }));
  });
}

function arrangeCarePlan(db, tasks, date, arrival) {
  if (!db.schedule.timeSlots.includes(arrival))
    throw httpError(409, 'Choose a listed arrival time.');
  const scheduled = [],
    remaining = [...tasks];
  const candidates = [...db.schedule.timeSlots].sort().filter((time) => time >= arrival);
  const working = { ...db, appointments: [...db.appointments] };
  while (remaining.length) {
    let next;
    for (const time of candidates) {
      for (const task of remaining) {
        try {
          assertSlot(working, task.service, date, time);
          for (const pet of task.pets)
            assertPetFree(working, pet.id, date, time, task.service.duration);
          next = { ...task, date, time };
          break;
        } catch (error) {
          if (error.status !== 409) throw error;
        }
      }
      if (next) break;
    }
    if (!next)
      throw httpError(
        409,
        'All selected care cannot fit into the available times on this day. Try an earlier arrival, another date, or fewer services.',
      );
    remaining.splice(
      remaining.findIndex((task) => task.service === next.service && task.pets === next.pets),
      1,
    );
    scheduled.push(next);
    working.appointments.push({
      id: `planned-${scheduled.length}`,
      date,
      time: next.time,
      petIds: next.pets.map((pet) => pet.id),
      serviceId: next.service.id,
      duration: next.service.duration,
      resource: next.service.resource,
      status: 'confirmed',
    });
  }
  if (scheduled[0].time !== arrival)
    throw httpError(
      409,
      'No selected service can begin at this arrival time. Choose a later available time.',
    );
  return scheduled;
}

function carePlanPreview(tasks) {
  return tasks.map(({ pets, service, date, time }) => ({
    petIds: pets.map((pet) => pet.id),
    petNames: pets.map((pet) => pet.name),
    serviceId: service.id,
    serviceName: service.name,
    date,
    time,
    basePrice: service.basePrice * pets.length,
  }));
}

module.exports = { selectCarePlan, arrangeCarePlan, carePlanPreview };
