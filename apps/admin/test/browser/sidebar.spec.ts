import { sidebarBrowserTests } from '../../../../packages/portal/test/sidebar-browser';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';
sidebarBrowserTests((page) => portalFixture(page, 'Admin'), login);
