import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: false,
    clearMocks: true,
    restoreMocks: true,
    maxWorkers: 2,
    testTimeout: 5000,
  },
});
