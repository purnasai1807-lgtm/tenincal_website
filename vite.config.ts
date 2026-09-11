import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      // The preview proxy does not expose Vite's HMR WebSocket endpoint.
      // Keep HMR disabled so /@vite/client never attempts a broken socket.
      hmr: false,
      // Disable file watching to avoid restarting the preview during syncs.
      watch: null,
    },
  };
});
