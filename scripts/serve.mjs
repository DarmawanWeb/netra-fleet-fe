// Serves the static export (out/) the way netra does: page files without .html, one exported
// page for every detail id, the API proxied (HTTP and WebSocket) to NETRA_API_URL.
// Usage: npm run build && NETRA_API_URL=http://localhost:8080 npm run preview

import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const ROOT = path.resolve('out');
const PORT = Number(process.env.PORT ?? 3000);
const API = process.env.NETRA_API_URL ? new URL(process.env.NETRA_API_URL) : null;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/x-component',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};
const DETAIL = /^\/(anomalies|patrols|robots|substation\/(?:assets|points|findings))\/([^/]+?)(\.txt)?$/;

/** The file for a request path, or null: the path, path.html, path/index.html, the detail page. */
export function resolve(root, urlPath) {
  const clean = path.posix.normalize(decodeURIComponent(urlPath));
  const detail = DETAIL.exec(clean);
  const candidates = [clean, `${clean}.html`, path.posix.join(clean, 'index.html')];
  if (detail) candidates.push(`/${detail[1]}/0${detail[3] ?? '.html'}`);
  for (const c of candidates) {
    const file = path.join(root, c);
    if (!file.startsWith(root)) return null;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function proxy(req, res) {
  const upstream = http.request(
    { host: API.hostname, port: API.port || 80, method: req.method, path: req.url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => (res.writeHead(502), res.end('API unreachable')));
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  if (API && pathname.startsWith('/api/')) return proxy(req, res);
  const file = resolve(ROOT, pathname);
  const status = file ? 200 : 404;
  const target = file ?? path.join(ROOT, '404.html');
  const headers = { 'Content-Type': TYPES[path.extname(target)] ?? 'application/octet-stream' };
  if (pathname.startsWith('/_next/static/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  res.writeHead(status, headers);
  fs.createReadStream(target).pipe(res);
});

// WebSocket: hand the raw socket to the API.
server.on('upgrade', (req, socket, head) => {
  if (!API || !req.url.startsWith('/api/')) return socket.destroy();
  const up = net.connect(Number(API.port || 80), API.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`, ...Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`)];
    up.write(lines.join('\r\n') + '\r\n\r\n');
    up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/serve.mjs')) {
  server.listen(PORT, () => console.log(`out/ on http://localhost:${PORT}${API ? `, /api -> ${API.origin}` : ''}`));
}
