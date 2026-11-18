import { sessionBrowserTests } from '../../../../packages/portal/test/session-browser';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';
sessionBrowserTests(
  (page) => portalFixture(page, 'Admin'),
  login,
  'مرحبًا بعودتك',
);
