import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8080);
const host = process.argv[4] || '127.0.0.1';
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
};

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65_535 ||
  !existsSync(root) ||
  (host !== 'localhost' && isIP(host) === 0)
) {
  throw new Error('Usage: node scripts/serve-static.mjs <existing-directory> <port> [host]');
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = resolve(root, requested);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  const selected = existsSync(file) && statSync(file).isFile() ? file : resolve(root, 'index.html');
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(selected)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(selected).pipe(response);
}).listen(port, host);
