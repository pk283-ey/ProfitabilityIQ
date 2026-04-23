import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = new URL(env.VITE_API_ENDPOINT || 'https://eyq-incubator.america.fabric.ey.com/eyq/us/api').origin

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api-proxy': {
          target: apiBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-proxy/, ''),
          secure: true,
        },
      },
    },
  }
})
