import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/trends/' : '/',
  build: {
    outDir: 'server/wwwroot/trends',
    emptyOutDir: true,
  },
}));
