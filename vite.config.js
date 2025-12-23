import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dit zorgt dat de app snapt dat hij op GitHub Pages staat
export default defineConfig({
  plugins: [react()],
  base: '/Gemini-3-pro-Architect/',
})
