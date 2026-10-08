const fs = require('node:fs');
const path = require('node:path');
const { send } = require('./http');
const { httpError } = require('./helpers');

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

module.exports = { MAX_UPLOAD, FORMATS, matchesFormat, readUpload, mediaFile, serveMedia };
