import { sessionBrowserTests } from '../../../../packages/portal/test/session-browser';
import { setup, login } from './fixtures';
sessionBrowserTests(
  setup,
  async (page) => {
    await page.goto('/');
    await login(page);
  },
  'أهلًا بعودتك',
);
