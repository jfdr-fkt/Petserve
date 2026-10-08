const { httpError } = require('./helpers');

const visitPetIds = (visit) => visit.petIds || [visit.petId];

function selectVisitPets(db, user, data, service) {
  const ids = data.petIds === undefined ? [data.petId] : data.petIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 6 || new Set(ids).size !== ids.length)
    throw httpError(400, 'Choose between one and six different pets.');
  if (ids.length > 1 && service.id !== 'consultation')
    throw httpError(
      400,
      'Multiple pets can share a veterinary consultation. Other services need separate visits.',
    );
  const pets = ids.map((id) =>
    db.pets.find((p) => p.id === id && p.ownerId === user.id && !p.deletedAt),
  );
  if (pets.some((pet) => !pet)) throw httpError(400, 'Choose active pets from your own profiles.');
  return pets;
}

module.exports = { visitPetIds, selectVisitPets };
