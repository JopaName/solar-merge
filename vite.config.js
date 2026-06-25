import { defineConfig } from 'vite'

export default defineConfig({
  base: './',

  server: {
    port: 3000,
    open: true,
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },

  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.svg', '**/*.gif', '**/*.webp', '**/*.mp3', '**/*.ogg', '**/*.wav'],
})
