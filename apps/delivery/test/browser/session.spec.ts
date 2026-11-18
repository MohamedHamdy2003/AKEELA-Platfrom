import { sessionBrowserTests } from '../../../../packages/portal/test/session-browser';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';
sessionBrowserTests(
  (page) => portalFixture(page, 'Delivery_Company'),
  login,
  'مرحبًا بعودتك',
);
