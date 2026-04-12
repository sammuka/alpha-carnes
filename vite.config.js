import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.md'],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          diagrams: ['cytoscape', 'cytoscape-dagre', 'd3'],
          content: ['marked', 'mermaid'],
        },
      },
    },
  },
});
