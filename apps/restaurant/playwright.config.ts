import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './test/browser',
  outputDir: join(tmpdir(), 'akeela-restaurant-playwright'),
  fullyParallel: false,
  use: {
    baseURL: url,
    viewport: { width: 1536, height: 1024 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url,
    reuseExistingServer: !process.env.CI && !process.env.PLAYWRIGHT_PORT,
  },
  reporter: 'list',
});
