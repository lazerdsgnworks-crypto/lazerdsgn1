import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: `__dirname` is not available in ES modules by default.
      // Replaced it with a path resolution from the current working directory,
      // which is the project root when running Vite.
      "@": path.resolve("./src"),
    },
  },
})