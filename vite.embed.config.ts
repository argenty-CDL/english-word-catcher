import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Build the game as a single self-contained <word-catcher> web component.
// Output: dist-embed/word-catcher.js — one file, React bundled in, CSS inlined.
// Drop it on any host (GitHub Pages) and load it with a <script> tag.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: {
    // Force React's production build inside the IIFE bundle.
    'process.env.NODE_ENV': '"production"',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  build: {
    outDir: 'dist-embed',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/embed.tsx'),
      name: 'WordCatcher',
      formats: ['iife'],
      fileName: () => 'word-catcher.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
