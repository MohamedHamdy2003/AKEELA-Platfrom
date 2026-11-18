import { sidebarBrowserTests } from '../../../../packages/portal/test/sidebar-browser';
import { setup, login } from './fixtures';
sidebarBrowserTests(setup, async (page) => {
  await page.goto('/');
  await login(page);
});
