import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { localBenchmarkApi } from './benchmark/vitePlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localBenchmarkApi()],
})
