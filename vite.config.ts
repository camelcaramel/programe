/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : 정적 호스팅(GitHub Pages 등) 하위 경로에서도 동작
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 6000 },
  // 게임 규칙(src/sim)은 브라우저 없이 Node 에서 테스트한다
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    // tokens.test.ts 가 style.css 를 ?raw 로 읽어 tokens.ts 와 값을 맞춰 본다 (기본값은 CSS 를 빈 문자열로 대신함)
    css: { include: [/src[\\/]ui[\\/]style\.css/] },
  },
});
