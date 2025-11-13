import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/lazerdsgn1/', // 👈 Base path for GitHub Pages
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: `__dirname` is not available in ES modules by default.
      // Using project root path for src alias.
      "@": path.resolve("./src"),
    },
  },
})
