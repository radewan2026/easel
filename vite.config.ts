import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'charts';
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('html2canvas')) return 'html2canvas';
          if (id.includes('jspdf')) return 'pdf-export';
          if (id.includes('@tanstack') || id.includes('@supabase')) return 'data-vendor';
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'react-vendor';
          return 'vendor';
        },
      },
    },
  },
  preview: {
    port: 9000,
  },
})
