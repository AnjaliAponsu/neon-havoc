// NEON HAVOC - Standalone Multiplayer WebSocket Server
import http from 'http';
import { setupMultiplayerServer } from './server/multiplayerServer.js';

const PORT = process.env.PORT || 3001;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('NEON HAVOC Dedicated Relay Server is Active!\n');
});

setupMultiplayerServer(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[NEON HAVOC] Dedicated Multiplayer Relay Server running on port ${PORT}`);
});

