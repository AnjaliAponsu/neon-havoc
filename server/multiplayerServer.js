// NEON HAVOC - High-Speed WebSocket Multiplayer Relay Server
import { WebSocketServer, WebSocket } from 'ws';
import os from 'node:os';
import { setupTeamDeathmatch } from './teamDeathmatchServer.js';

function getLocalLanIps() {
  const ips = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
  } catch (e) {}
  return ips;
}

export function setupMultiplayerServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65536 });
  setupTeamDeathmatch(wss);

  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 10000);

  httpServer.on('close', () => {
    clearInterval(heartbeatInterval);
    for (const client of wss.clients) client.terminate();
    wss.close();
  });

  const rooms = new Map(); // roomCode -> { host: ws, client: ws, sector: null, inGame: false }

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
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let currentRoomCode = null;
    let currentRole = null; // 'HOST' | 'CLIENT'

    // Send server info with detected LAN IPs to help players connect over WiFi
    try {
      const lanIps = getLocalLanIps();
      ws.send(JSON.stringify({
        type: 'SERVER_INFO',
        lanIps,
        message: 'Connected to NEON HAVOC Relay'
      }));
    } catch (e) {}

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case 'CREATE_ROOM': {
            // Clean up any room this socket was previously hosting
            if (currentRoomCode) {
              const oldRoom = rooms.get(currentRoomCode);
              if (oldRoom && oldRoom.host === ws) {
                if (oldRoom.client && oldRoom.client.readyState === WebSocket.OPEN) {
                  oldRoom.client.send(JSON.stringify({ type: 'PEER_DISCONNECTED', message: 'Host recreated room.' }));
                }
                rooms.delete(currentRoomCode);
              }
            }

            const roomCode = generateRoomCode();
            rooms.set(roomCode, { host: ws, client: null, sector: msg.sector || null, inGame: false });
            currentRoomCode = roomCode;
            currentRole = 'HOST';
            ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomCode }));
            break;
          }

          case 'JOIN_ROOM': {
            const code = (msg.roomCode || '').trim().toUpperCase();
            const room = rooms.get(code);
            if (!room) {
              ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Sector Code [' + code + '] not found! Check the 4-letter code.' }));
              return;
            }

            // CHECK 1: Prevent Host from joining their own room as Client!
            if (room.host === ws) {
              ws.send(JSON.stringify({
                type: 'JOIN_ERROR',
                message: 'You are already hosting Sector [' + code + ']! Give this code to Player 2 on their laptop.'
              }));
              return;
            }

            // CHECK 2: If the same client re-connects or confirms, return JOIN_SUCCESS
            if (room.client === ws) {
              ws.send(JSON.stringify({
                type: 'JOIN_SUCCESS',
                roomCode: code,
                role: 'CLIENT',
                sector: room.sector
              }));
              return;
            }

            // CHECK 3: Check Sector Capacity and handle stale lobby connections gracefully
            if (room.client && room.client.readyState === WebSocket.OPEN) {
              if (room.inGame) {
                // Match actively in progress
                ws.send(JSON.stringify({ type: 'JOIN_ERROR', message: 'Sector is already full (2/2 Players in-game)!' }));
                return;
              } else {
                // Still in lobby! Gracefully replace the old/stale client socket (e.g. page refresh / retry)
                try {
                  room.client.send(JSON.stringify({ type: 'PEER_DISCONNECTED', message: 'Replaced by new connection.' }));
                  room.client.terminate();
                } catch (e) {}
                room.client = null;
              }
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

          case 'LEAVE_ROOM': {
            if (currentRoomCode) {
              const room = rooms.get(currentRoomCode);
              if (room) {
                if (currentRole === 'HOST' && room.host === ws) {
                  if (room.client && room.client.readyState === WebSocket.OPEN) {
                    room.client.send(JSON.stringify({ type: 'PEER_DISCONNECTED', message: 'Host left sector.' }));
                  }
                  rooms.delete(currentRoomCode);
                } else if (currentRole === 'CLIENT' && room.client === ws) {
                  room.client = null;
                  room.inGame = false;
                  if (room.host && room.host.readyState === WebSocket.OPEN) {
                    room.host.send(JSON.stringify({ type: 'PEER_DISCONNECTED', message: 'Player 2 left sector.' }));
                  }
                }
              }
              currentRoomCode = null;
              currentRole = null;
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

            // Track inGame state for capacity management
            if (msg.event === 'START_GAME' || msg.event === 'MATCH_START') {
              room.inGame = true;
            } else if (msg.event === 'GAME_OVER' || msg.event === 'RETURN_LOBBY') {
              room.inGame = false;
            }

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
          if (currentRole === 'HOST' && room.host === ws) {
            if (room.client && room.client.readyState === WebSocket.OPEN) {
              room.client.send(JSON.stringify({ type: 'PEER_DISCONNECTED', message: 'Host disconnected from sector.' }));
            }
            rooms.delete(currentRoomCode);
          } else if (currentRole === 'CLIENT' && room.client === ws) {
            room.client = null;
            room.inGame = false;
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

