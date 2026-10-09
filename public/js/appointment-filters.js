import { todayManila } from './utils.js';

export function matchesAppointmentFilter(appointment, filter, today = todayManila()) {
  if (filter === 'all') return true;
  if (filter === 'upcoming')
    return ['pending', 'confirmed'].includes(appointment.status) && appointment.date >= today;
  return appointment.status === filter;
}
