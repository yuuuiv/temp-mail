import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png'],
      manifest: {
        name: 'Temp Email',
        short_name: 'Temp Email',
        description: 'Temp Email — Temporary Email',
        theme_color: '#1c2321',
        background_color: '#eef1ef',
        display: 'standalone',
        icons: [{ src: '/logo.png', sizes: '192x192', type: 'image/png' }],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 开发时把 API 请求转发到你的 worker，按需修改 target
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/open_api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/admin': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/telegram': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/external': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
