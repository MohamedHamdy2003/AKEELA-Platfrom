import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './test/browser',
  outputDir: join(tmpdir(), 'akeela-delivery-playwright'),
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5175',
    viewport: { width: 1536, height: 1024 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
