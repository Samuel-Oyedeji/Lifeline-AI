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
})
