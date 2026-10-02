import { state, isStaff } from '../state.js';
import { heading, button, icon, empty, viewButton, stats } from '../components.js';
import { escapeHTML as e, dateLabel } from '../utils.js';

export const stars = (rating) =>
  `<span class="feedback-stars" aria-label="${rating} out of 5 stars">${Array.from({ length: 5 }, (_, i) => `<span class="${i < rating ? 'filled' : ''}" aria-hidden="true">${icon('star')}</span>`).join('')}<strong>${rating}/5</strong></span>`;
const recordedDate = (date) =>
  new Date(date).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export function gallery() {
  const staff = isStaff(),
    posts = state.data.gallery;
  return `${heading('A glimpse of life at Petopia', 'Petopia gallery', 'Fresh trims, happy moments, and a closer look at the care we give.', staff ? button('Add photo or video', 'gallery-upload', 'camera') : '')}<div class="gallery-intro">${icon('camera')}<p>Photos and videos shared by the Petopia team. This gallery is visible to all signed-in customers.</p></div>${posts.length ? `<div class="gallery-grid">${posts.map((post) => `<article class="panel gallery-card"><div class="gallery-media">${post.mime.startsWith('video/') ? `<video controls preload="metadata" playsinline aria-label="${e(post.caption)}"><source src="${post.url}" type="${post.mime}">Your browser does not support this video.</video>` : `<img src="${post.url}" alt="${e(post.caption)}" loading="lazy">`}</div><div class="gallery-card-body"><p class="gallery-caption">${e(post.caption)}</p><div class="gallery-meta"><span>${e(post.serviceName)}</span><time datetime="${post.createdAt}">${recordedDate(post.createdAt)}</time></div>${staff ? button('Remove post', 'gallery-remove', '', 'outline', `data-id="${post.id}"`) : ''}</div></article>`).join('')}</div>` : `<section class="panel">${empty('Good moments are on their way.', staff ? 'Share a grooming photo, a short video, or a moment from the clinic.' : 'The Petopia team will share photos and short videos here.', staff ? button('Share the first moment', 'gallery-upload', 'camera', 'soft') : '', 'camera')}</section>`}`;
}

export function feedback() {
  const staff = isStaff(),
    records = state.data.feedback;
  const unreviewed = state.data.appointments.filter(
    (a) => a.status === 'completed' && !records.some((f) => f.appointmentId === a.id),
  );
  const average = records.length
    ? (records.reduce((sum, f) => sum + f.rating, 0) / records.length).toFixed(1)
    : '—';
  return `${heading(staff ? 'Listen, learn, and care a little better.' : 'Your experience matters.', staff ? 'Customer feedback' : 'My feedback', staff ? 'Feedback from completed visits, with space for a thoughtful reply.' : 'Let the Petopia team know how your completed visit went.')}${
    staff
      ? stats([
          ['Visit feedback', records.length, 'feedback', 'sage'],
          ['Average rating', average, 'star', 'sand'],
          ['Awaiting a reply', records.filter((f) => !f.reply).length, 'queue', 'lavender'],
        ])
      : `<div class="gallery-intro">${icon('feedback')}<p>Your feedback is shared with the clinic team. Only you and authorized staff can see it.</p></div>`
  }${!staff && unreviewed.length ? `<section class="panel feedback-eligible"><div class="panel-header"><div><h2>How did the visit go?</h2><p>A small note helps us make their next visit better.</p></div></div>${unreviewed.map((a) => `<div class="payment-row"><div><strong>${e(a.petName)} · ${e(a.serviceName)}</strong><small>${dateLabel(a.date)}</small></div>${button('Leave feedback', 'feedback-write', 'feedback', 'soft', `data-id="${a.id}"`)}</div>`).join('')}</section>` : ''}<div class="feedback-list">${
    records.length
      ? [...records]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((f) => {
            const appointment = state.data.appointments.find((a) => a.id === f.appointmentId);
            return `<article class="panel feedback-card"><div class="feedback-card-header"><div><h3>${e(appointment?.serviceName || 'Completed visit')}</h3><small>${staff ? `${e(f.customerName)} · ` : ''}${e(appointment?.petName || 'Companion')}${appointment ? ` · ${dateLabel(appointment.date)}` : ''}</small></div>${stars(f.rating)}</div>${f.comment ? `<p>${e(f.comment)}</p>` : '<p class="muted">Rating shared without a comment.</p>'}${f.reply ? `<div class="feedback-reply"><strong>Reply from the care team</strong><p>${e(f.reply.text)}</p><small>${e(f.reply.staffName)} · ${recordedDate(f.reply.recordedAt)}</small></div>` : ''}<div class="feedback-actions"><small>Updated ${recordedDate(f.updatedAt)}</small>${staff ? button(f.reply ? 'Edit reply' : 'Reply', 'feedback-reply', 'feedback', 'outline', `data-id="${f.id}"`) : button('Edit feedback', 'feedback-write', 'edit', 'outline', `data-id="${f.appointmentId}"`)}</div></article>`;
          })
          .join('')
      : `<section class="panel">${empty(staff ? 'A little listening starts here.' : 'Your next visit has a voice.', staff ? 'Customer ratings and comments will appear after completed visits.' : 'After a completed visit, you can share a rating and a note with the team.', staff ? '' : viewButton('View appointments', 'appointments', 'calendar', 'soft'), 'feedback')}</section>`
  }</div>`;
}
