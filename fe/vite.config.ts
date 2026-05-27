import tailwindcss from '@tailwindcss/vite';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vueJsx(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 15173,
    strictPort: true,
  },
});
