import { state } from './state.js';
import { field } from './components.js';
import { escapeHTML as e, dateLabel } from './utils.js';

export function uploadPreview() {
  const file = state.mediaFile;
  if (!file || !state.mediaPreview)
    return '<p class="upload-details muted">Choose a photo or short video to preview it here.</p>';
  return `<div class="upload-preview">${file.type.startsWith('video/') ? `<video src="${state.mediaPreview}" controls playsinline preload="metadata" aria-label="Video preview"></video>` : `<img src="${state.mediaPreview}" alt="Selected photo preview">`}</div><p class="upload-details">${e(file.name)} · ${(file.size / (1024 * 1024)).toFixed(1)} MB</p>`;
}

export function communityDialog(type, id, d) {
  if (type === 'feedback-write') {
    const a = state.data.appointments.find((a) => a.id === id);
    return {
      title: 'How was their visit?',
      description: `${a.petName} · ${a.serviceName} · ${dateLabel(a.date)}`,
      label: d.id ? 'Update feedback' : 'Share feedback',
      content: `${field('Your rating', 'rating', d.rating || '', {
        required: true,
        choices: [
          ['', 'Choose a rating'],
          ['5', '5 · Excellent'],
          ['4', '4 · Good'],
          ['3', '3 · Okay'],
          ['2', '2 · Could be better'],
          ['1', '1 · Disappointing'],
        ],
      })}${field('Your experience (optional)', 'comment', d.comment, { type: 'textarea', attrs: 'maxlength="1000"', placeholder: 'What went well? Is there anything we can do better?' })}<p class="form-footnote">Shared with the clinic team. You can update your feedback later.</p>`,
    };
  }
  if (type === 'feedback-reply')
    return {
      title: 'A thoughtful reply.',
      description: 'Respond to the customer’s visit feedback.',
      label: 'Save reply',
      content: field('Reply to the customer', 'text', d.text, {
        type: 'textarea',
        required: true,
        attrs: 'maxlength="1000"',
        placeholder: 'Thank them for sharing and address their experience.',
      }),
    };
  if (type === 'gallery-upload')
    return {
      title: 'Add photo or video',
      description: 'Visible to all signed-in customers in the Petopia gallery.',
      label: 'Post to gallery',
      content: `<div class="field"><label for="gallery-file">Photo or short video</label><input type="file" id="gallery-file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required><small>JPG, PNG, WebP, MP4 or WebM · up to 25 MB</small><div id="upload-preview">${uploadPreview()}</div></div>${field('Caption', 'caption', d.caption, { type: 'textarea', required: true, attrs: 'maxlength="300"', placeholder: 'Describe the photo or video.' })}${field('Service (optional)', 'serviceId', d.serviceId || '', { choices: [['', 'Life at Petopia'], ...state.data.services.map((s) => [s.id, s.name])] })}<label class="upload-consent"><input type="checkbox" name="permission" required><span>I have permission to share this photo or video with Petopia customers.</span></label>`,
    };
  if (type === 'gallery-remove')
    return {
      title: 'Remove this moment?',
      description: 'The photo or video will be removed from the shared gallery.',
      label: 'Remove post',
      content: `<div class="subtle-note">${e(d.caption)}</div>`,
    };
  return null;
}
