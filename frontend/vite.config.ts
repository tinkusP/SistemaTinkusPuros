// import { defineConfig } from 'vite'
// import { fileURLToPath, URL} from 'node:url'
// import react from '@vitejs/plugin-react-swc'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   resolve: {
//     alias:{
//     '@' : fileURLToPath(new URL('./src', import.meta.url))
//     }
//   }
// })

import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react-swc'

const certificadoLocal = fileURLToPath(new URL('../certificados-locales/servidor.crt', import.meta.url))
const llaveLocal = fileURLToPath(new URL('../certificados-locales/servidor.key', import.meta.url))
const httpsLocal = existsSync(certificadoLocal) && existsSync(llaveLocal)
  ? { cert: readFileSync(certificadoLocal), key: readFileSync(llaveLocal) }
  : undefined

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: httpsLocal,

    // Solo para pruebas temporales con Cloudflare
    allowedHosts: true,

    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
