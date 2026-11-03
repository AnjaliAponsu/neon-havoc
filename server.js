// NEON HAVOC - Standalone Multiplayer WebSocket Server
import http from 'http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupMultiplayerServer } from './server/multiplayerServer.js';

const PORT = process.env.PORT || 3001;
const staticRoot = fileURLToPath(new URL('./dist/', import.meta.url));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, {'Content-Type':'application/json'}); res.end('{"status":"ok"}'); return; }
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = path.resolve(staticRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
  } catch { res.writeHead(400); res.end(); return; }
  if (!file.startsWith(path.resolve(staticRoot) + path.sep)) { res.writeHead(403); res.end(); return; }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, {'Content-Type':'text/plain'});
    res.end('File not found. Run npm run build before starting the game server.');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache' });
  if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
});

setupMultiplayerServer(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[NEON HAVOC] Dedicated Multiplayer Relay Server running on port ${PORT}`);
});

