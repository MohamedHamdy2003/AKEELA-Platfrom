import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './test/browser',
  outputDir: join(tmpdir(), 'akeela-restaurant-playwright'),
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1536, height: 1024 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
