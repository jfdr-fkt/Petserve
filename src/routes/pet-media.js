const fs = require('node:fs');
const path = require('node:path');
const { send, requireUser } = require('../http');
const { clean, httpError } = require('../helpers');
const { newId, now } = require('../db');
const { FORMATS, matchesFormat, readUpload, mediaFile, serveMedia } = require('../media');

const MAX_PET_MEDIA = 50;

module.exports = async ({
  req,
  res,
  pathname,
  url,
  db,
  user,
  sessions,
  token,
  persist,
  uploadsDir,
}) => {
  const route = /^\/api\/pets\/([a-f0-9-]+)\/media(?:\/([a-f0-9-]+)(\/content)?)?$/.exec(pathname);
  if (!route) return false;
  requireUser(user);
  const pet = db.pets.find((item) => item.id === route[1] && !item.deletedAt);
  if (!pet) throw httpError(404, 'Pet profile not found.');
  if (user.role === 'customer' && pet.ownerId !== user.id)
    throw httpError(403, 'This pet’s photos and videos are private.');
  const directory = path.join(uploadsDir, 'pets');

  if (!route[2] && req.method === 'POST') {
    requireUser(user, 'customer');
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
      throw httpError(403, 'Cross-origin request blocked.');
    const mime = (req.headers['content-type'] || '').split(';')[0];
    if (!FORMATS[mime]) throw httpError(415, 'Choose a JPG, PNG, WebP, MP4 or WebM file.');
    const caption = url.searchParams.get('caption') || '';
    if (caption.length > 300) throw httpError(400, 'Keep the caption within 300 characters.');
    const buffer = await readUpload(req);
    if (!buffer.length || !matchesFormat(buffer, mime))
      throw httpError(400, 'The file contents do not match the selected image or video format.');
    // The account, session, and pet may change while the upload is streaming.
    if (!db.users.includes(user) || user.disabled || sessions.get(token) !== user.id)
      throw httpError(403, 'Account access has changed. Sign in again.');
    requireUser(user, 'customer');
    if (!db.pets.includes(pet) || pet.deletedAt || pet.ownerId !== user.id)
      throw httpError(409, 'This pet profile is no longer available for uploads.');
    if (db.petMedia.filter((item) => item.petId === pet.id).length >= MAX_PET_MEDIA)
      throw httpError(409, 'This pet’s album has 50 items. Remove an older item to add another.');

    const item = {
      id: newId(),
      petId: pet.id,
      mime,
      size: buffer.length,
      caption: clean(caption, 300),
      createdAt: now(),
    };
    item.filename = item.id + FORMATS[mime];
    fs.mkdirSync(directory, { recursive: true });
    const file = mediaFile(directory, item);
    fs.writeFileSync(file, buffer, { flag: 'wx' });
    db.petMedia.push(item);
    try {
      persist();
    } catch (error) {
      db.petMedia.pop();
      fs.unlinkSync(file);
      throw error;
    }
    send(res, 201, { id: item.id });
    return true;
  }

  if (route[2]) {
    const item = db.petMedia.find((entry) => entry.petId === pet.id && entry.id === route[2]);
    if (!item) throw httpError(404, 'Photo or video not found.');
    if (route[3] && ['GET', 'HEAD'].includes(req.method)) {
      serveMedia(req, res, mediaFile(directory, item), item.mime);
      return true;
    }
    if (!route[3] && req.method === 'DELETE') {
      requireUser(user, 'customer');
      const index = db.petMedia.indexOf(item);
      db.petMedia.splice(index, 1);
      try {
        persist();
      } catch (error) {
        db.petMedia.splice(index, 0, item);
        throw error;
      }
      const file = mediaFile(directory, item);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      send(res, 200, { ok: true });
      return true;
    }
  }
  throw httpError(405, 'Method not allowed.');
};
