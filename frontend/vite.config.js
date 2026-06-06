import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base is './' so the build works from any S3 bucket path / static host.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/ambulances': 'http://localhost:8000',
      '/dispatch':   'http://localhost:8000',
      '/api':        'http://localhost:8000',
      '/mock':       'http://localhost:8000',
      '/health':     'http://localhost:8000',
      '/ws': {
        target:       'ws://localhost:8000',
        ws:           true,
        changeOrigin: true,
      },
    },
  },
})
