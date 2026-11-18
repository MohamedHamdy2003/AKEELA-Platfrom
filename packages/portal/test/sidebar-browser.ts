import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function sidebarBrowserTests(
  setup: (page: Page) => Promise<unknown>,
  login: (page: Page) => Promise<unknown>,
) {
  for (const reduced of [false, true]) {
    test(`sidebar collapse keeps navigation accessible${reduced ? ' with reduced motion' : ' and adapts to the mobile drawer'}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1536, height: 960 });
      await page.emulateMedia({
        reducedMotion: reduced ? 'reduce' : 'no-preference',
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await setup(page);
      await login(page);
      const sidebar = page.locator('aside.sidebar');
      const workspace = page.locator(
        '.portal-shell > .workspace, .app-shell > .workspace',
      );
      const expanded = (await sidebar.boundingBox())!.width;
      const beforeWidth = (await workspace.boundingBox())!.width;
      expect(expanded).toBeGreaterThan(200);
      if (!reduced)
        await page.screenshot({
          path: join(
            tmpdir(),
            `akeela-sidebar-expanded-${new URL(page.url()).port}.png`,
          ),
        });
      const collapse = page.getByRole('button', {
        name: 'طي القائمة الجانبية',
        exact: true,
      });
      await collapse.focus();
      await page.keyboard.press('Enter');
      const expand = page.getByRole('button', {
        name: 'توسيع القائمة الجانبية',
        exact: true,
      });
      await expect(expand).toHaveAttribute('aria-expanded', 'false');
      await expect
        .poll(async () => Math.round((await sidebar.boundingBox())!.width))
        .toBe(80);
      expect((await workspace.boundingBox())!.width).toBeGreaterThan(
        beforeWidth + 100,
      );
      const account = page
        .getByRole('navigation')
        .getByRole('button', { name: 'حسابي', exact: true });
      await expect(account).toHaveAttribute('title', 'حسابي');
      await account.focus();
      await page.keyboard.press('Enter');
      await expect(account).toHaveAttribute('aria-current', 'page');
      if (!reduced)
        await page.screenshot({
          path: join(
            tmpdir(),
            `akeela-sidebar-collapsed-${new URL(page.url()).port}.png`,
          ),
        });
      if (reduced) {
        await expect(page.locator('.portal-shell, .app-shell')).toHaveCSS(
          'transition-duration',
          '0s',
        );
      }
      await expand.click();
      await expect
        .poll(async () => Math.round((await sidebar.boundingBox())!.width))
        .toBe(expanded);
      await expect(collapse).toHaveAttribute('aria-expanded', 'true');
      await collapse.click();
      await expect
        .poll(async () => Math.round((await sidebar.boundingBox())!.width))
        .toBe(80);
      if (!reduced) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page
          .getByRole('button', { name: 'فتح القائمة', exact: true })
          .click();
        await expect(page.getByRole('navigation')).toBeVisible();
        await expect(expand).not.toBeVisible();
        expect((await sidebar.boundingBox())!.width).toBeGreaterThan(200);
        await page.screenshot({
          path: join(
            tmpdir(),
            `akeela-sidebar-mobile-${new URL(page.url()).port}.png`,
          ),
        });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('navigation')).not.toBeVisible();
        await expect(
          page.getByRole('button', { name: 'فتح القائمة', exact: true }),
        ).toBeFocused();
        await page
          .getByRole('button', { name: 'فتح القائمة', exact: true })
          .click();
        await page.setViewportSize({ width: 1536, height: 960 });
        await expect(expand).toBeVisible();
        await expect
          .poll(async () => Math.round((await sidebar.boundingBox())!.width))
          .toBe(80);
        await expect(workspace).not.toHaveAttribute('inert');
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      expect(errors).toEqual([]);
    });
  }
}
