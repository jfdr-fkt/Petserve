import { state, isStaff } from './state.js';
import { button, empty, field, icon } from './components.js';
import { escapeHTML as e } from './utils.js';
import { uploadPreview } from './community-dialogs.js';

export function petMediaContent(pet) {
  const staff = isStaff();
  const items = state.data.petMedia.filter((item) => item.petId === pet.id);
  const add = staff
    ? ''
    : button('Add photo or video', 'pet-media-upload', 'camera', 'primary', `data-id="${pet.id}"`);
  return `<div class="section-header pet-media-heading"><div><h3>Photos & videos</h3><p>Photos and videos for this pet, visible to their owner and the care team.</p></div>${add}</div>${
    items.length
      ? `<div class="pet-media-grid">${items
          .map((item) => {
            const video = item.mime.startsWith('video/');
            const caption = item.caption || `${video ? 'Video' : 'Photo'} of ${pet.name}`;
            const date = new Date(item.createdAt).toLocaleDateString('en-PH', {
              timeZone: 'Asia/Manila',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            return `<article class="panel gallery-card pet-media-card"><div class="gallery-media">${video ? `<video src="${e(item.url)}" controls playsinline preload="metadata" aria-label="${e(caption)}"></video>` : `<button type="button" class="pet-media-photo" data-action="pet-media-view" data-id="${item.id}" aria-label="View ${e(caption)}"><img src="${e(item.url)}" alt="${e(caption)}" loading="lazy" decoding="async"></button>`}</div><div class="gallery-card-body"><p class="gallery-caption">${e(caption)}</p><div class="gallery-meta"><span>${video ? 'Video' : 'Photo'} · ${(item.size / (1024 * 1024)).toFixed(1)} MB</span><time datetime="${e(item.createdAt)}">${date}</time></div><div class="actions pet-media-actions">${button('View', 'pet-media-view', 'expand', 'soft', `data-id="${item.id}" aria-label="View ${e(caption)}"`)}${staff ? '' : button('Remove', 'pet-media-remove', 'trash', 'outline', `data-id="${item.id}" aria-label="Remove ${e(caption)}"`)}</div></div></article>`;
          })
          .join(
            '',
          )}</div><p class="pet-media-count muted small-text">${items.length} of 50 photos and videos</p>`
      : empty(
          'No photos or videos',
          staff
            ? 'Photos and videos added by this pet’s owner will appear here.'
            : 'Add a photo or video to this pet’s album.',
          add,
          'camera',
        )
  }`;
}

export function petMediaDialog(type, id, draft) {
  if (type === 'pet-media-upload') {
    const pet = state.data.pets.find((item) => item.id === id);
    return {
      title: `Add photo or video · ${e(pet.name)}`,
      description: 'Saved to this pet’s album. Only you and the care team can see it.',
      label: 'Save to pet album',
      content: `<div class="field"><label for="pet-media-file">Photo or short video</label><input type="file" id="pet-media-file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" required><small>JPG, PNG, WebP, MP4 or WebM · up to 25 MB each</small><div id="upload-preview">${uploadPreview()}</div></div>${field('Caption (optional)', 'caption', draft.caption, { type: 'textarea', attrs: 'maxlength="300"', placeholder: 'A favorite walk, a new trick, or just being them.' })}<p class="form-footnote">You can keep up to 50 photos and videos for each pet.</p>`,
    };
  }
  if (type === 'pet-media-remove')
    return {
      title: 'Remove this photo or video?',
      description: 'This will permanently remove it from the pet’s album.',
      label: 'Remove from album',
      content: `<div class="subtle-note">${e(draft.caption || 'This saved pet moment')}</div>`,
    };
  return null;
}

export function petMediaViewer(id) {
  const item = state.data.petMedia.find((entry) => entry.id === id);
  const pet = state.data.pets.find((entry) => entry.id === item.petId);
  const video = item.mime.startsWith('video/');
  const caption = item.caption || `${video ? 'Video' : 'Photo'} of ${pet.name}`;
  return `<div class="modal-backdrop"><section class="modal-card wide pet-media-viewer" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-header"><div><h2 id="dialog-title">${e(pet.name)}’s ${video ? 'video' : 'photo'}</h2><p>${e(caption)}</p></div><button type="button" class="icon-button" data-action="dialog-close" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body">${video ? `<video src="${e(item.url)}" controls playsinline preload="metadata" aria-label="${e(caption)}"></video>` : `<img src="${e(item.url)}" alt="${e(caption)}">`}</div><div class="modal-footer">${button('Close', 'dialog-close', '', 'outline')}</div></section></div>`;
}
