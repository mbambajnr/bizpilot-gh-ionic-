import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
};

/**
 * Serves the built web app (dist/) so one hosted server delivers both the
 * laptop/browser client and the /api routes — same origin, no extra infra.
 * Returns null when dist/index.html is absent (API-only mode, e.g. local dev
 * where Vite serves the app itself).
 */
export function createStaticServer(distDir) {
  const root = path.resolve(distDir);
  const indexPath = path.join(root, 'index.html');
  if (!existsSync(indexPath)) {
    return null;
  }

  function send(response, filePath, statusCode = 200) {
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      // Vite emits content-hashed filenames under /assets — cache those hard.
      // Everything else (notably index.html) must revalidate so deploys land.
      'Cache-Control': filePath.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    };
    response.writeHead(statusCode, headers);
    createReadStream(filePath).pipe(response);
  }

  return function serveStatic(request, response) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return false;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://internal').pathname);
    } catch {
      return false;
    }

    const filePath = path.normalize(path.join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      // Path traversal attempt — refuse.
      response.writeHead(403, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: false, message: 'Forbidden.' }));
      return true;
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      send(response, filePath);
      return true;
    }

    // SPA fallback: client-side routes resolve to index.html.
    send(response, indexPath);
    return true;
  };
}
