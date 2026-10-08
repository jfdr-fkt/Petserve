import { state } from './state.js';
import { userAvatar } from './components.js';

export function profilePhotoMarkup() {
  const user = { ...state.data.user, photoUrl: state.accountPhoto ?? state.data.user.photoUrl };
  return `${userAvatar(user, 'profile-photo')}<div class="profile-photo-actions"><label class="btn btn-outline" for="account-photo">Choose photo<input id="account-photo" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only"></label><button type="button" class="text-button" data-action="account-photo-remove" ${user.photoUrl ? '' : 'hidden'}>Remove photo</button><small>JPG, PNG or WebP · Up to 10 MB</small></div>`;
}
function updatePhoto() {
  const editor = document.querySelector('#profile-photo-editor');
  if (editor) editor.innerHTML = profilePhotoMarkup();
}
export function removeProfilePhoto() {
  state.accountPhoto = '';
  updatePhoto();
}
export async function chooseProfilePhoto(file) {
  if (!file) return;
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error('Choose a JPG, PNG or WebP photo up to 10 MB.');
  const form = document.querySelector('form[data-form=account]');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (!form?.isConnected) return;
    state.accountPhoto = canvas.toDataURL('image/jpeg', 0.88);
    updatePhoto();
  } catch {
    throw new Error('This photo could not be read. Try another image.');
  } finally {
    bitmap?.close();
  }
}
