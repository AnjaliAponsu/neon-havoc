// NEON HAVOC - High-Speed WebSocket Multiplayer Relay Server
import { WebSocketServer, WebSocket } from 'ws';

export function setupMultiplayerServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map(); // roomCode -> { host: ws, client: ws, sector: null }

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host || 'localhost';
      const url = new URL(request.url, `http://${host}`);
      if (url.pathname === '/ws' || url.pathname === '/ws/') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (err) {
      // Fallback url check if URL parsing fails
      if (request.url && (request.url.startsWith('/ws') || request.url === '/')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    }
  });

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return rooms.has(code) ? generateRoomCode() : code;
  }

  wss.on('connection', (ws) => {
    let currentRoomCode = null;
    let currentRole = null; // 'HOST' | 'CLIENT'

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case 'CREATE_ROOM': {
            const roomCode = generateRoomCode();
            rooms.set(roomCode, { host: ws, client: null, sector: msg.sector || null });
            currentRoomCode = roomCode;
            currentRole = 'HOST';
            ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomCode }));
            break;
          }

          case 'JOIN_ROOM': {
            const code = (msg.roomCode || '').trim().toUpperCase();
            const room = rooms.get(code);
            if (!room) {
              ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Sector Code not found! Check your 4-letter code.' }));
              return;
            }
            if (room.client && room.client.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Sector is already full (2/2 Players)!' }));
              return;
            }

            room.client = ws;
            currentRoomCode = code;
            currentRole = 'CLIENT';

            ws.send(JSON.stringify({
              type: 'JOIN_SUCCESS',
              roomCode: code,
              role: 'CLIENT',
              sector: room.sector
            }));

            if (room.host && room.host.readyState === WebSocket.OPEN) {
              room.host.send(JSON.stringify({ type: 'PLAYER_JOINED', role: 'HOST' }));
            }
            break;
          }

          case 'RELAY_STATE': {
            if (!currentRoomCode) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;
            const target = currentRole === 'HOST' ? room.client : room.host;
            if (target && target.readyState === WebSocket.OPEN) {
              target.send(JSON.stringify({ type: 'PEER_STATE', payload: msg.payload }));
            }
            break;
          }

          case 'RELAY_EVENT': {
            if (!currentRoomCode) return;
            const room = rooms.get(currentRoomCode);
            if (!room) return;
            const target = currentRole === 'HOST' ? room.client : room.host;
            if (target && target.readyState === WebSocket.OPEN) {
              target.send(JSON.stringify({ type: 'PEER_EVENT', event: msg.event, data: msg.data }));
            }
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG', time: msg.time }));
            break;
          }
        }
      } catch (err) {
        console.error('Multiplayer relay message error:', err);
      }
    });

    ws.on('close', () => {
      if (currentRoomCode) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          if (currentRole === 'HOST') {
            if (room.client && room.client.readyState === WebSocket.OPEN) {
              room.client.send(JSON.stringify({ type: 'PEER_DISCONNECTED', message: 'Host disconnected from sector.' }));
            }
            rooms.delete(currentRoomCode);
          } else if (currentRole === 'CLIENT') {
            room.client = null;
            if (room.host && room.host.readyState === WebSocket.OPEN) {
              room.host.send(JSON.stringify({ type: 'PEER_DISCONNECTED', message: 'Player 2 disconnected from sector.' }));
            }
          }
        }
      }
    });
  });

  return wss;
}

