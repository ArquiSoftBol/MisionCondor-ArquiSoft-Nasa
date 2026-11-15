import { defineConfig } from 'vite';

// base './' para que dist/ funcione en cualquier subcarpeta (GitHub Pages, zip local)
export default defineConfig({
  base: './',
  // en desarrollo, el multijugador corre aparte: npm run servidor (puerto 8787)
  server: { port: 5173, proxy: { '/ws': { target: 'ws://localhost:8787', ws: true }, '/api': 'http://localhost:8787' } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
