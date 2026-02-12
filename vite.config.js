import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import mkcert from 'vite-plugin-mkcert'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    mkcert(), // V2: Plugin para generar certificados SSL válidos automáticamente
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['dunfy_fondo_coscuro.png', 'icono_xfy.png'],
      manifest: {
        name: 'Dunamix Scanner',
        short_name: 'Dunamix',
        description: 'Scanner QR/Barcode para control de entregas',
        version: '1.0.1', // Incrementar versión para forzar actualización
        theme_color: '#00D9C0',
        background_color: '#0a0e1a',
        display: 'standalone',
        icons: [
          {
            src: '/icono_xfy.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/dunfy_fondo_coscuro.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // IMPORTANTE: NetworkFirst para evitar caché de archivos JS viejos
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 5 // 5 minutos (caché corto)
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hora
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true
    // V2: HTTPS habilitado automáticamente por vite-plugin-mkcert
    // Genera certificados confiables que no requieren aceptar advertencias
  }
})
