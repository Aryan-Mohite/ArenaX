import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Dev server proxies API calls to the Express backend
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    // FIX: react-snap's bundled Puppeteer launches a very old Chromium
    // (~Chrome 78-79) that predates optional chaining (?.) and nullish
    // coalescing (??), both ES2020 features. Without an explicit target,
    // esbuild's default output includes them, and the prerender step
    // crashes with "SyntaxError: Unexpected token '?'". es2017 is the
    // newest standard target below ES2020, so this keeps output modern
    // for real users while staying parseable by react-snap's Chromium.
    target: 'es2017',
    // SEO ADD: Minify CSS — reduces file size, improves LCP score
    cssMinify: true,
    // SEO ADD: minify with esbuild (default) is fastest; keep it explicit
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          network: ['axios'],
        },
        // SEO ADD: Named asset file pattern — helps with cache-busting
        // Vite already hashes asset names; this makes them more readable in logs
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 500,
  },
})