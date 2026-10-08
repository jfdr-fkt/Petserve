const fs = require('node:fs');
const path = require('node:path');
const { httpError } = require('./helpers');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function send(res, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5000000) {
        reject(httpError(413, 'Request is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const data = raw ? JSON.parse(raw) : {};
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw new Error('Invalid body');
        resolve(data);
      } catch {
        reject(httpError(400, 'Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function requireUser(user, role) {
  if (!user) throw httpError(401, 'Please sign in first.');
  if (role && !(Array.isArray(role) ? role : [role]).includes(user.role))
    throw httpError(403, 'You do not have access to this action.');
}

function requireJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''))
    throw httpError(415, 'Send JSON data.');
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
    throw httpError(403, 'Cross-origin request blocked.');
}

function serveStatic(res, pathname, req) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);

  // Allow index.html, styles.css, favicon.svg, and anything under js/
  const mimeMap = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.mp4': 'video/mp4',
  };
  const ext = path.extname(relative);
  const mime = mimeMap[ext];
  const file = path.join(PUBLIC_DIR, relative);

  // Security: must stay inside public directory
  if (!mime || (!file.startsWith(PUBLIC_DIR + path.sep) && file !== PUBLIC_DIR)) {
    throw httpError(404, 'Page not found.');
  }
  if (!fs.existsSync(file)) throw httpError(404, 'Page not found.');
  if (ext === '.mp4') return require('./media').serveMedia(req, res, file, mime);

  const bytes = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': `${mime}; charset=utf-8`,
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
  });
  res.end(bytes);
}

module.exports = { send, readBody, requireUser, requireJson, serveStatic };
