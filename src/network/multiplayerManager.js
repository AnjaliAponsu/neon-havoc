// NEON HAVOC — Client Multiplayer Network Manager
export class MultiplayerManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isMultiplayerActive = false;
    this.role = null; // 'HOST' | 'CLIENT' | null
    this.roomCode = null;
    this.pingMs = 0;
    this.lastPingSent = 0;

    // Callbacks
    this.onStatusChangeCb = null;
    this.onRoomCreatedCb = null;
    this.onPlayerJoinedCb = null;
    this.onJoinSuccessCb = null;
    this.onJoinErrorCb = null;
    this.onPeerStateCb = null;
    this.onPeerEventCb = null;
    this.onPeerDisconnectedCb = null;

    this.reconnectTimer = null;
  }

  connect(url = null) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const defaultUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      const targetUrl = url || defaultUrl;

      try {
        this.ws = new WebSocket(targetUrl);
      } catch (e) {
        return reject(e);
      }

      this.ws.onopen = () => {
        this.isConnected = true;
        this._startHeartbeat();
        if (this.onStatusChangeCb) this.onStatusChangeCb(true);
        resolve();
      };

      this.ws.onerror = (err) => {
        console.warn('[Multiplayer] WebSocket encountered an issue:', err);
        if (this.onStatusChangeCb) this.onStatusChangeCb(false);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this._stopHeartbeat();
        if (this.onStatusChangeCb) this.onStatusChangeCb(false);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch (e) {
          console.error('[Multiplayer] Failed to parse packet:', e);
        }
      };
    });
  }

  createRoom(sector = null) {
    if (!this.isConnected) {
      return this.connect().then(() => this.createRoom(sector));
    }
    this.role = 'HOST';
    this.ws.send(JSON.stringify({
      type: 'CREATE_ROOM',
      sector: sector ? { id: sector.id, name: sector.name, accentColor: sector.accentColor } : null
    }));
  }

  joinRoom(code) {
    if (!this.isConnected) {
      return this.connect().then(() => this.joinRoom(code));
    }
    this.role = 'CLIENT';
    this.ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      roomCode: (code || '').trim().toUpperCase()
    }));
  }

  sendState(payload) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'RELAY_STATE',
      payload
    }));
  }

  sendEvent(event, data = {}) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'RELAY_EVENT',
      event,
      data
    }));
  }

  disconnect() {
    this.isMultiplayerActive = false;
    this.role = null;
    this.roomCode = null;
    this._stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'ROOM_CREATED':
        this.roomCode = msg.roomCode;
        if (this.onRoomCreatedCb) this.onRoomCreatedCb(msg.roomCode);
        break;

      case 'PLAYER_JOINED':
        this.isMultiplayerActive = true;
        if (this.onPlayerJoinedCb) this.onPlayerJoinedCb();
        break;

      case 'JOIN_SUCCESS':
        this.roomCode = msg.roomCode;
        this.isMultiplayerActive = true;
        if (this.onJoinSuccessCb) this.onJoinSuccessCb(msg.roomCode, msg.sector);
        break;

      case 'JOIN_ERROR':
        if (this.onJoinErrorCb) this.onJoinErrorCb(msg.message);
        break;

      case 'PEER_STATE':
        if (this.onPeerStateCb) this.onPeerStateCb(msg.payload);
        break;

      case 'PEER_EVENT':
        if (this.onPeerEventCb) this.onPeerEventCb(msg.event, msg.data);
        break;

      case 'PEER_DISCONNECTED':
        this.isMultiplayerActive = false;
        if (this.onPeerDisconnectedCb) this.onPeerDisconnectedCb(msg.message);
        break;

      case 'PONG':
        this.pingMs = Math.round(performance.now() - msg.time);
        break;
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSent = performance.now();
        this.ws.send(JSON.stringify({ type: 'PING', time: this.lastPingSent }));
      }
    }, 3000);
  }

  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const multiplayerManager = new MultiplayerManager();

