import { test, expect, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function sessionBrowserTests(
  setup: (page: Page) => Promise<unknown>,
  login: (page: Page) => Promise<unknown>,
  authHeading: string,
) {
  test('reload restores the route, expired access rotates once, logout stays logged out', async ({
    page,
  }) => {
    await setup(page);
    await login(page);
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'حسابي', exact: true })
      .click();
    let rotations = 0;
    await page.route('**/api/v1/auth/refresh', async (route) => {
      rotations++;
      await route.fulfill({
        json: {
          success: true,
          data: {
            access_token: 'rotated-test-access',
            refresh_token: 'rotated-test-refresh',
            expires_in: 900,
            refresh_expires_in: 1000,
          },
        },
      });
    });
    await page.route('**/api/v1/me', async (route) => {
      if (
        route.request().headers().authorization !== 'Bearer rotated-test-access'
      )
        await route.fulfill({
          status: 401,
          json: { success: false, error: { code: 'UNAUTHENTICATED' } },
        });
      else await route.fallback();
    });
    await page.reload();
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'حسابي', exact: true }),
    ).toBeVisible();
    expect(rotations).toBe(1);
    await page.reload();
    await expect(page.getByRole('navigation')).toBeVisible();
    expect(rotations).toBe(1);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await page
      .getByRole('button', { name: 'تسجيل الخروج', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: authHeading }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith('akeela.session:'),
        ),
      ),
    ).toEqual([]);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: authHeading }),
    ).toBeVisible();
  });

  test('temporary bootstrap failure offers retry without discarding the session; revocation ends it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page);
    await login(page);
    let unavailable = true;
    await page.route('**/api/v1/me', async (route) => {
      if (unavailable)
        await route.fulfill({
          status: 503,
          json: { success: false, message: 'تعذّر الاتصال بالخدمة.' },
        });
      else await route.fallback();
    });
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'إعادة المحاولة', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: join(
        tmpdir(),
        `akeela-session-retry-${new URL(page.url()).port}.png`,
      ),
    });
    await expect(page.getByRole('navigation')).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: authHeading }),
    ).not.toBeVisible();
    unavailable = false;
    await page
      .getByRole('button', { name: 'إعادة المحاولة', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'فتح القائمة', exact: true }),
    ).toBeVisible();
    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 401,
        json: { success: false, error: { code: 'UNAUTHENTICATED' } },
      }),
    );
    await page.route('**/api/v1/me', (route) =>
      route.fulfill({
        status: 401,
        json: { success: false, error: { code: 'UNAUTHENTICATED' } },
      }),
    );
    await page.reload();
    await expect(
      page.getByRole('heading', { name: authHeading }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith('akeela.session:'),
        ),
      ),
    ).toEqual([]);
  });

  test('corrupt saved sessions do not break login', async ({ page }) => {
    await setup(page);
    await page.goto('/');
    await page.evaluate(() => {
      for (const role of ['Admin', 'Delivery_Company', 'Restaurant'])
        sessionStorage.setItem(`akeela.session:${role}:/api/v1`, '{invalid');
    });
    await page.reload();
    await expect(
      page.getByRole('heading', { name: authHeading }),
    ).toBeVisible();
  });
}
