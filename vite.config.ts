import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// base: './' にしておくと、GitHub Pages（https://ユーザー名.github.io/リポジトリ名/）
// でも Vercel でも、そのまま動きます。
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: {
    format: 'es',
  },
});
