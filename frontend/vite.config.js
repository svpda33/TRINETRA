import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || env.API_URL || env.BACKEND_URL || ''

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'API_', 'BACKEND_'],
    define: {
      'process.env.API_URL': JSON.stringify(apiUrl),
      'process.env.BACKEND_URL': JSON.stringify(apiUrl),
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        }
      }
    }
  }
})
