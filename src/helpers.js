// src/helpers.js — Shared utility functions: date validation, cleaning, errors.
const { TIME_SLOTS } = require('./config');

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** Trim and truncate a string field from user input. */
function clean(value, limit = 120) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

// ─── Date & Time ──────────────────────────────────────────────────────────────

/** Returns current date and time in Asia/Manila timezone. */
function manilaNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
}

/** Check if a date string is a valid ISO calendar date. */
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Check if a date+time combination is a bookable weekend slot
 * within 90 days from today (Manila time).
 */
function dateIsBookable(date, time) {
  if (!validDate(date) || !TIME_SLOTS.includes(time)) return false;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (day !== 0 && day !== 6) return false; // Must be Saturday (6) or Sunday (0)
  const present = manilaNow();
  const daysAhead = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${present.date}T00:00:00Z`)) / 86400000
  );
  return daysAhead >= 0 && daysAhead <= 90 && (daysAhead !== 0 || time > present.time);
}

module.exports = { httpError, clean, manilaNow, validDate, dateIsBookable };
