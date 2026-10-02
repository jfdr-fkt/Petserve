// src/config.js — All constants for PetServe. Edit services and time slots here.

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

const SERVICES = [
  {
    id: 'grooming',
    name: 'Pet grooming',
    group: 'Grooming',
    resource: 'groomer',
    icon: '✂',
    description: 'Request a grooming visit for your pet.',
    basePrice: 50000 // in centavos (₱500.00)
  },
  {
    id: 'vaccination',
    name: 'Vaccination',
    group: 'Pet wellness',
    resource: 'veterinarian',
    icon: '✚',
    description: 'Request a vaccination appointment; clinical decisions stay with the veterinarian.',
    basePrice: 40000 // ₱400.00
  },
  {
    id: 'deworming',
    name: 'Deworming',
    group: 'Pet wellness',
    resource: 'veterinarian',
    icon: '◈',
    description: 'Request a deworming visit; clinical decisions stay with the veterinarian.',
    basePrice: 30000 // ₱300.00
  }
];

const STATUSES = ['pending', 'confirmed', 'completed', 'rejected', 'cancelled'];

const PAYMENT_METHODS = ['Cash', 'E-wallet', 'GCash', 'Maya', 'Credit Card', 'Other'];

const DEMO_SCHEDULE_NOTE =
  'Sample booking slots, Saturday and Sunday only, Asia/Manila. Confirm staff availability with Petopia.';

module.exports = { TIME_SLOTS, SERVICES, STATUSES, PAYMENT_METHODS, DEMO_SCHEDULE_NOTE };
