import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  // FIX M6: Explicit build config for production
  build: {
    outDir: 'dist',
    // Never expose sourcemaps in production — they leak your full source code
    sourcemap: false,
    // Chunk splitting: keeps initial bundle small, vendor libs cached separately
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom'],
          router:  ['react-router-dom'],
          network: ['axios', 'socket.io-client'],
        },
      },
    },
    // Warn on chunks > 500 KB
    chunkSizeWarningLimit: 500,
  },
})
