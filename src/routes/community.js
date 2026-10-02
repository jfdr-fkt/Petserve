const fs = require('node:fs');
const path = require('node:path');
const { send, readBody, requireUser, requireJson } = require('../http');
const { clean, httpError } = require('../helpers');
const { newId, now } = require('../db');

const MAX_UPLOAD = 25 * 1024 * 1024;
const FORMATS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

function matchesFormat(buffer, mime) {
  if (mime === 'image/jpeg') return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mime === 'image/png')
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp')
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'video/mp4') return buffer.toString('ascii', 4, 8) === 'ftyp';
  if (mime === 'video/webm')
    return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

function readUpload(req) {
  if (Number(req.headers['content-length']) > MAX_UPLOAD) {
    req.resume();
    throw httpError(413, 'Choose a photo or short video up to 25 MB.');
  }
  return new Promise((resolve, reject) => {
    let size = 0,
      rejected = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_UPLOAD) {
        rejected = true;
        chunks.length = 0;
        reject(httpError(413, 'Choose a photo or short video up to 25 MB.'));
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks));
    });
    req.on('aborted', () => reject(httpError(400, 'The upload was interrupted. Try again.')));
    req.on('error', reject);
  });
}

function mediaFile(uploadsDir, item) {
  // Files are generated locally, never from a supplied client path or filename.
  if (!/^[a-f0-9-]+\.(jpg|png|webp|mp4|webm)$/.test(item.filename))
    throw httpError(404, 'Media not found.');
  return path.join(uploadsDir, item.filename);
}

function serveMedia(req, res, file, mime) {
  if (!fs.existsSync(file)) throw httpError(404, 'Media file not found.');
  const size = fs.statSync(file).size;
  let start = 0,
    end = size - 1,
    status = 200;
  if (req.headers.range) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!range || (!range[1] && !range[2])) {
      send(res, 416, { error: 'Invalid media range.' }, { 'Content-Range': `bytes */${size}` });
      return;
    }
    if (range[1]) {
      start = Number(range[1]);
      end = range[2] ? Number(range[2]) : size - 1;
    } else {
      start = Math.max(0, size - Number(range[2]));
      end = size - 1;
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= size ||
      end < start
    ) {
      send(res, 416, { error: 'Invalid media range.' }, { 'Content-Range': `bytes */${size}` });
      return;
    }
    end = Math.min(end, size - 1);
    status = 206;
  }
  res.writeHead(status, {
    'Content-Type': mime,
    'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = fs.createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

module.exports = async ({ req, res, pathname, url, db, user, persist, uploadsDir }) => {
  const feedbackRoute = /^\/api\/appointments\/([a-f0-9-]+)\/feedback$/.exec(pathname);
  if (feedbackRoute && req.method === 'POST') {
    requireUser(user, 'customer');
    requireJson(req);
    const appointment = db.appointments.find((a) => a.id === feedbackRoute[1]);
    if (!appointment || appointment.customerId !== user.id)
      throw httpError(404, 'Visit not found.');
    if (appointment.status !== 'completed')
      throw httpError(409, 'You can leave feedback after a completed visit.');
    const data = await readBody(req),
      rating = Number(data.rating);
    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      (data.comment && (typeof data.comment !== 'string' || data.comment.length > 1000))
    )
      throw httpError(400, 'Choose a rating from 1 to 5 and a comment up to 1,000 characters.');
    let feedback = db.feedback.find((f) => f.appointmentId === appointment.id);
    const created = !feedback;
    if (!feedback) {
      feedback = {
        id: newId(),
        appointmentId: appointment.id,
        customerId: user.id,
        createdAt: now(),
        reply: null,
      };
      db.feedback.push(feedback);
    }
    Object.assign(feedback, { rating, comment: clean(data.comment, 1000), updatedAt: now() });
    persist();
    send(res, created ? 201 : 200, { feedback });
    return true;
  }
  const replyRoute = /^\/api\/feedback\/([a-f0-9-]+)\/reply$/.exec(pathname);
  if (replyRoute && req.method === 'PATCH') {
    requireUser(user, ['staff', 'admin']);
    requireJson(req);
    const feedback = db.feedback.find((f) => f.id === replyRoute[1]);
    if (!feedback) throw httpError(404, 'Feedback not found.');
    const data = await readBody(req);
    if (!clean(data.text, 1000) || typeof data.text !== 'string' || data.text.length > 1000)
      throw httpError(400, 'Write a reply up to 1,000 characters.');
    feedback.reply = { text: clean(data.text, 1000), staffName: user.name, recordedAt: now() };
    persist();
    send(res, 200, { feedback });
    return true;
  }
  if (pathname === '/api/gallery' && req.method === 'POST') {
    requireUser(user, ['staff', 'admin']);
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
      throw httpError(403, 'Cross-origin request blocked.');
    const mime = (req.headers['content-type'] || '').split(';')[0];
    if (!FORMATS[mime]) throw httpError(415, 'Choose a JPG, PNG, WebP, MP4 or WebM file.');
    const caption = clean(url.searchParams.get('caption'), 300),
      serviceId = url.searchParams.get('serviceId') || '';
    if (!caption || (serviceId && !db.services.some((s) => s.id === serviceId)))
      throw httpError(400, 'Add a caption and choose a listed service.');
    if (url.searchParams.get('permission') !== 'true')
      throw httpError(400, 'Confirm you have permission to share this media with customers.');
    const buffer = await readUpload(req);
    if (!buffer.length || !matchesFormat(buffer, mime))
      throw httpError(400, 'The file contents do not match the selected image or video format.');
    if (db.gallery.length >= 100)
      throw httpError(
        409,
        'The gallery has reached 100 posts. Remove an older post before adding another.',
      );
    const item = {
      id: newId(),
      mime,
      size: buffer.length,
      caption,
      serviceId,
      createdAt: now(),
      uploadedBy: user.id,
    };
    item.filename = item.id + FORMATS[mime];
    fs.mkdirSync(uploadsDir, { recursive: true });
    const file = mediaFile(uploadsDir, item);
    fs.writeFileSync(file, buffer, { flag: 'wx' });
    db.gallery.push(item);
    try {
      persist();
    } catch (error) {
      db.gallery.pop();
      fs.unlinkSync(file);
      throw error;
    }
    send(res, 201, { id: item.id });
    return true;
  }
  const galleryRoute = /^\/api\/gallery\/([a-f0-9-]+)(\/content)?$/.exec(pathname);
  if (galleryRoute) {
    requireUser(user);
    const item = db.gallery.find((m) => m.id === galleryRoute[1]);
    if (!item) throw httpError(404, 'Gallery post not found.');
    if (galleryRoute[2] && ['GET', 'HEAD'].includes(req.method)) {
      serveMedia(req, res, mediaFile(uploadsDir, item), item.mime);
      return true;
    }
    if (!galleryRoute[2] && req.method === 'DELETE') {
      requireUser(user, ['staff', 'admin']);
      const file = mediaFile(uploadsDir, item),
        index = db.gallery.indexOf(item);
      db.gallery.splice(index, 1);
      try {
        persist();
      } catch (error) {
        db.gallery.splice(index, 0, item);
        throw error;
      }
      if (fs.existsSync(file)) fs.unlinkSync(file);
      send(res, 200, { ok: true });
      return true;
    }
  }
  return false;
};
