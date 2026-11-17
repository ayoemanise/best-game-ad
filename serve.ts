// NOVA HARVEST — local dev server. Serves game/ on http://localhost:8080
// so the game can be played and screenshotted in a desktop browser.
// Node 22, standard library only.
//
//   node serve.ts [port]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'game');
const PORT = Number(process.argv[2] || 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const path = normalize(join(ROOT, decodeURIComponent(req.url || '/').split('?')[0]));
  const file = path.endsWith('/') || path === ROOT ? join(path, 'index.html') : path;
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`NOVA HARVEST at http://localhost:${PORT}/`);
});
