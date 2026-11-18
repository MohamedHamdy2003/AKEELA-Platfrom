import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export function logoutBrowserTests(
  setup: (page: Page) => Promise<unknown>,
  login: (page: Page) => Promise<unknown>,
  authHeading: string,
) {
  for (const width of [1536, 390]) {
    test(`logout asks for confirmation, cancellation keeps the session, and confirm revokes it at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      if (width === 390) await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await setup(page);
      await login(page);
      const originalOverflow = await page.evaluate(
        () => document.body.style.overflow,
      );
      let requests = 0;
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.endsWith('/auth/logout'))
          requests++;
      });
      const open = async () => {
        if (width < 961)
          await page
            .getByRole('button', { name: 'فتح القائمة', exact: true })
            .click();
        await page
          .getByRole('button', { name: 'تسجيل الخروج', exact: true })
          .click();
      };
      await open();
      const dialog = page.getByRole('dialog', {
        name: 'تأكيد تسجيل الخروج',
        exact: true,
      });
      const cancel = dialog.getByRole('button', {
        name: 'البقاء في اللوحة',
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect(cancel).toBeFocused();
      const confirmLabel = dialog.locator('.logout-confirmation-label');
      await expect(confirmLabel).toBeVisible();
      const labelGeometry = await confirmLabel.evaluate((element) => {
        const label = element.getBoundingClientRect();
        const button = element.parentElement!.getBoundingClientRect();
        return {
          label: {
            left: label.left,
            right: label.right,
            top: label.top,
            bottom: label.bottom,
          },
          button: {
            left: button.left,
            right: button.right,
            top: button.top,
            bottom: button.bottom,
          },
          color: getComputedStyle(element).color,
        };
      });
      expect(labelGeometry.color).toBe('rgb(255, 255, 255)');
      expect(labelGeometry.label.top).toBeGreaterThanOrEqual(
        labelGeometry.button.top,
      );
      expect(labelGeometry.label.bottom).toBeLessThanOrEqual(
        labelGeometry.button.bottom,
      );
      await expect(dialog).toContainText('تأكد من حفظ أي تغييرات');
      expect(requests).toBe(0);
      if (width === 390)
        await expect(dialog).toHaveCSS('animation-name', 'none');
      await page.screenshot({
        path: join(
          tmpdir(),
          `akeela-logout-${new URL(page.url()).port}-${width}.png`,
        ),
      });
      await cancel.click();
      await expect(dialog).not.toBeVisible();
      const restoredFocus = page.getByRole('button', {
        name: width < 961 ? 'فتح القائمة' : 'تسجيل الخروج',
        exact: true,
      });
      await expect(restoredFocus).toBeFocused();
      await expect
        .poll(() => page.evaluate(() => document.body.style.overflow))
        .toBe(originalOverflow);
      await open();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      expect(requests).toBe(0);
      expect(
        await page.evaluate(() =>
          Object.keys(sessionStorage).some((key) =>
            key.startsWith('akeela.session:'),
          ),
        ),
      ).toBeTruthy();
      await open();
      await dialog
        .getByRole('button', { name: 'تأكيد تسجيل الخروج', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: authHeading, exact: true }),
      ).toBeVisible();
      expect(requests).toBe(1);
      expect(
        await page.evaluate(() =>
          Object.keys(sessionStorage).some((key) =>
            key.startsWith('akeela.session:'),
          ),
        ),
      ).toBeFalsy();
      await page.reload();
      await expect(
        page.getByRole('heading', { name: authHeading, exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
  test('logout blocks duplicate confirmations and dismissal while pending, then allows retry after failure', async ({
    page,
  }) => {
    await setup(page);
    await login(page);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    await page.route('**/api/v1/auth/logout', async (route) => {
      requests++;
      if (requests === 1) {
        await pending;
        await route.fulfill({ status: 503, json: { success: false } });
      } else await route.fulfill({ json: { success: true, data: null } });
    });
    await page
      .getByRole('button', { name: 'تسجيل الخروج', exact: true })
      .click();
    const dialog = page.getByRole('dialog', {
      name: 'تأكيد تسجيل الخروج',
      exact: true,
    });
    const confirm = dialog.locator('.logout-confirmation-confirm');
    await dialog.evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
    const before = (await confirm.boundingBox())!;
    await confirm.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(confirm).toBeDisabled();
    await expect(
      dialog.getByRole('button', { name: 'البقاء في اللوحة', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect.poll(() => requests).toBe(1);
    expect((await confirm.boundingBox())!.width).toBeCloseTo(before.width, 0);
    release();
    await expect(dialog.getByRole('alert')).toContainText('تعذّر تسجيل الخروج');
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).some((key) =>
          key.startsWith('akeela.session:'),
        ),
      ),
    ).toBeTruthy();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(
      page.getByRole('heading', { name: authHeading, exact: true }),
    ).toBeVisible();
    expect(requests).toBe(2);
  });
}
