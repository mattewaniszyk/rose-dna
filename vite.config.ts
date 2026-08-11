import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const ffmpegCorePath = path.resolve(
  __dirname,
  'public/ffmpeg/ffmpeg-core.js',
)

function serveFfmpegCoreInDevelopment() {
  return {
    name: 'serve-ffmpeg-core-in-development',
    apply: 'serve' as const,
    load(id: string) {
      if (id.split('?', 1)[0] === '/ffmpeg/ffmpeg-core.js') {
        return readFileSync(ffmpegCorePath, 'utf8')
      }

      return null
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [serveFfmpegCoreInDevelopment(), react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
