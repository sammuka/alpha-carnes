import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.md'],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('cytoscape') || id.includes('/d3/') || id.includes('/d3-')) {
            return 'diagrams';
          }
          if (id.includes('marked') || id.includes('mermaid')) {
            return 'content';
          }
        },
      },
    },
  },
});
