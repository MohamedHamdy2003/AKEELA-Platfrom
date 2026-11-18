import { logoutBrowserTests } from '../../../../packages/portal/test/logout-browser';
import { setup, login } from './fixtures';
logoutBrowserTests(
  setup,
  async (page) => {
    await page.goto('/');
    await login(page);
  },
  'أهلًا بعودتك',
);
