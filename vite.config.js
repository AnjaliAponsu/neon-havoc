import { defineConfig } from 'vite';
import { setupMultiplayerServer } from './server/multiplayerServer.js';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'neon-havoc-multiplayer-relay',
      configureServer(server) {
        setupMultiplayerServer(server.httpServer);
      }
    }
  ],
  server: {
    host: true,
    port: 5173
  }
});

