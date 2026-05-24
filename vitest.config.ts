import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: [
      'tests/e2e/**',
      '**/*.spec.{ts,tsx}',
      'test-results/**',
      '.next/**',
      'node_modules/**',
    ],
    environment: 'node',
  },
});
