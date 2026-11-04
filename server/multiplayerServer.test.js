import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { setupMultiplayerServer } from './multiplayerServer.js';

function startTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer();
    setupMultiplayerServer(server);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

function createClient(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const queue = [];
    const listeners = [];

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        for (let i = 0; i < listeners.length; i++) {
          if (listeners[i].predicate(msg)) {
            const { resolve: res, timer } = listeners.splice(i, 1)[0];
            clearTimeout(timer);
            return res(msg);
          }
        }
        queue.push(msg);
      } catch (e) {}
    });

    ws.waitFor = (predicate, timeoutMs = 2500, label = '') => {
      return new Promise((res, rej) => {
        for (let i = 0; i < queue.length; i++) {
          if (predicate(queue[i])) {
            return res(queue.splice(i, 1)[0]);
          }
        }
        const timer = setTimeout(() => {
          rej(new Error(`Timeout waiting for message [${label}]`));
        }, timeoutMs);
        listeners.push({ predicate, resolve: res, timer });
      });
    };

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

test('multiplayerServer: host creation, self-join rejection, and 2-player join workflow', async (t) => {
  const { server, port } = await startTestServer();

  try {
    const hostWs = await createClient(port);
    const serverInfo = await hostWs.waitFor(m => m.type === 'SERVER_INFO', 2500, 'SERVER_INFO');
    assert.ok(serverInfo.lanIps, 'SERVER_INFO returns LAN IPs array');

    // 1. Host creates room
    hostWs.send(JSON.stringify({ type: 'CREATE_ROOM', sector: { id: 1, name: 'The Grid' } }));
    const createdMsg = await hostWs.waitFor(m => m.type === 'ROOM_CREATED', 2500, 'ROOM_CREATED');
    const roomCode = createdMsg.roomCode;
    assert.equal(typeof roomCode, 'string');
    assert.equal(roomCode.length, 4);

    // 2. CRITICAL BUG REPRO: Host accidentally sends JOIN_ROOM with their own code
    // With fix: server rejects host and leaves client slot open for Player 2!
    hostWs.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode }));
    const selfJoinError = await hostWs.waitFor(m => m.type === 'JOIN_ERROR', 2500, 'JOIN_ERROR (self-join)');
    assert.ok(selfJoinError.message.includes('already hosting Sector'), 'Host cannot fill client slot of their own room');

    // 3. Player 2 connects from second socket and joins room
    const clientWs = await createClient(port);
    await clientWs.waitFor(m => m.type === 'SERVER_INFO', 2500, 'client SERVER_INFO');
    clientWs.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode }));

    const [clientSuccess, hostNotified] = await Promise.all([
      clientWs.waitFor(m => m.type === 'JOIN_SUCCESS', 2500, 'JOIN_SUCCESS'),
      hostWs.waitFor(m => m.type === 'PLAYER_JOINED', 2500, 'PLAYER_JOINED')
    ]);

    assert.equal(clientSuccess.roomCode, roomCode);
    assert.equal(clientSuccess.role, 'CLIENT');
    assert.equal(hostNotified.type, 'PLAYER_JOINED');

    // 4. Client re-confirming / retrying receives JOIN_SUCCESS (not "already full")
    clientWs.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode }));
    const clientRejoin = await clientWs.waitFor(m => m.type === 'JOIN_SUCCESS', 2500, 'rejoin JOIN_SUCCESS');
    assert.equal(clientRejoin.roomCode, roomCode);

    // 5. While in lobby, a reconnecting/replacement client takes the slot smoothly
    const client2Ws = await createClient(port);
    await client2Ws.waitFor(m => m.type === 'SERVER_INFO', 2500, 'client2 SERVER_INFO');
    client2Ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode }));
    const client2Success = await client2Ws.waitFor(m => m.type === 'JOIN_SUCCESS', 2500, 'client2 JOIN_SUCCESS');
    assert.equal(client2Success.roomCode, roomCode);

    // 6. Once game is active (inGame = true), 3rd player is rejected with full message
    hostWs.send(JSON.stringify({ type: 'RELAY_EVENT', event: 'START_GAME' }));
    await new Promise(r => setTimeout(r, 60)); // allow event to process

    const client3Ws = await createClient(port);
    await client3Ws.waitFor(m => m.type === 'SERVER_INFO', 2500, 'client3 SERVER_INFO');
    client3Ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode }));
    const fullError = await client3Ws.waitFor(m => m.type === 'JOIN_ERROR', 2500, 'full JOIN_ERROR');
    assert.ok(fullError.message.includes('already full'), 'Rejects 3rd player when match is in-game');

    // Cleanup sockets
    hostWs.close();
    clientWs.close();
    client2Ws.close();
    client3Ws.close();
  } finally {
    server.close();
  }
});
