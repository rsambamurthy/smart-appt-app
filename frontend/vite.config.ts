import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => ({
  // Capacitor needs relative paths — do NOT set base: '/' explicitly
  plugins: [
    react(),
    VitePWA({
      // Disable service worker in mobile mode (Capacitor handles its own caching)
      disable: mode === 'development' || mode === 'mobile',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'SmartAppt',
        short_name: 'SmartAppt',
        description: 'Apartment Association Facilities Management',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.appassoc\.app\/api\/v1\/(maintenance\/my|announcements|dues\/bills\/my)/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-cache' },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 'backend' resolves via Docker DNS to the smartappt-api container
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
}));
