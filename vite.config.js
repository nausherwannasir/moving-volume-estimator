import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest config. The estimation/vehicle logic is plain JS, so a node
  // environment is enough; switch to 'jsdom' if/when component tests are added.
  test: {
    environment: 'node',
  },
})
