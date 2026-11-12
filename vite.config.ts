import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : 정적 호스팅(GitHub Pages 등) 하위 경로에서도 동작
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 6000 },
});
