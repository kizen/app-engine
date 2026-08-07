#!/usr/bin/env node
/**
 * Minimal static server for previewing docs/site/dist.
 *
 *   cd docs/site && npm run serve        → http://localhost:4173
 *
 * The built site also opens fine straight from disk (`open dist/index.html`); this exists for when
 * you want a real origin — for example to check the site the way a hosted deploy would serve it.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 4173;
// Loopback only. Omitting the host makes Node bind the wildcard address, which publishes the preview
// to the whole local network — not what a local preview server should do.
const HOST = process.env.HOST || '127.0.0.1';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  // Resolve inside DIST and confirm containment, so `..` can't escape the output directory.
  const candidate = path.resolve(DIST, `.${path.posix.normalize(decoded)}`);
  if (candidate !== DIST && !candidate.startsWith(DIST + path.sep)) return null;

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const index = path.join(candidate, 'index.html');
      await stat(index);
      return index;
    }
    return candidate;
  } catch {
    return null;
  }
}

const server = http.createServer(async (request, response) => {
  const file = await resolveFile(request.url || '/');
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('404 Not Found');
    return;
  }
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
    // Unknown types fall back to octet-stream; stop the browser second-guessing that.
    'x-content-type-options': 'nosniff',
  });
  createReadStream(file).pipe(response);
});

try {
  await stat(DIST);
} catch {
  console.error('  site/dist not found — run `npm run build` first.\n');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`\n  Kizen Plugin Docs → http://localhost:${PORT}\n`);
});
