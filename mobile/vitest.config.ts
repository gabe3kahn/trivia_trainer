import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure logic (the answer grader today). RN component tests are out of
// scope here — those need a native-mock harness; this config only runs *.test.ts under
// src/, which are plain TS with no React Native runtime imports.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
