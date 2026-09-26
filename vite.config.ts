import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages: https://sakanayuki.github.io/cc_bugcatching/
  base: '/cc_bugcatching/',
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
