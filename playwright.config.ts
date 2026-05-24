import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  testMatch: '**/*.spec.ts',
  reporter: [
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.LIVENOTE_E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    headless: true,
    viewport: {
      width: 1280,
      height: 720,
    },
    screenshot: 'on',
  },
});
