// Initial service menu and opening times. Staff edits are persisted in the database.

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

const SERVICES = [
  {
    id: 'grooming',
    name: 'Pet grooming',
    group: 'Grooming',
    resource: 'groomer',
    icon: '✂',
    description: 'Request a grooming visit for your pet.',
    basePrice: 50000, // in centavos (₱500.00)
  },
  {
    id: 'vaccination',
    name: 'Vaccination',
    group: 'Pet wellness',
    resource: 'veterinarian',
    icon: '✚',
    description:
      'Request a vaccination appointment; clinical decisions stay with the veterinarian.',
    basePrice: 40000, // ₱400.00
  },
  {
    id: 'deworming',
    name: 'Deworming',
    group: 'Pet wellness',
    resource: 'veterinarian',
    icon: '◈',
    description: 'Request a deworming visit; clinical decisions stay with the veterinarian.',
    basePrice: 30000, // ₱300.00
  },
  {
    id: 'consultation',
    name: 'Veterinary consultation',
    group: 'Pet wellness',
    resource: 'veterinarian',
    description: 'A visit with the veterinarian to discuss your pet’s care.',
    basePrice: 35000,
  },
];

SERVICES.forEach((service) => Object.assign(service, { duration: 60, active: true }));

const STATUSES = ['pending', 'confirmed', 'completed', 'rejected', 'cancelled'];

const PAYMENT_METHODS = ['Cash', 'E-wallet', 'GCash', 'Maya', 'Credit Card', 'Other'];

module.exports = { TIME_SLOTS, SERVICES, STATUSES, PAYMENT_METHODS };
