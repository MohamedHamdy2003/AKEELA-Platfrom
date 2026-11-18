import { logoutBrowserTests } from '../../../../packages/portal/test/logout-browser';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';
logoutBrowserTests(
  (page) => portalFixture(page, 'Admin'),
  login,
  'مرحبًا بعودتك',
);
