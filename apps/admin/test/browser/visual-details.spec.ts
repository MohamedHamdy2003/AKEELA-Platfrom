import { test, expect } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  portalFixture,
  login,
} from '../../../../packages/portal/test/browser-fixtures';

for (const width of [1536, 390]) {
  test(`user IDs and verification labels remain separate at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await portalFixture(page, 'Admin');
    await login(page);
    if (width < 680)
      await page.getByRole('button', { name: 'فتح القائمة' }).click();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'المستخدمون', exact: true })
      .click();
    await expect(
      page.getByRole('columnheader', { name: 'الرقم' }),
    ).toBeVisible();
    const row = page.getByRole('row').filter({
      has: page.getByRole('cell', { name: 'عميل أكيلة', exact: true }),
    });
    await expect(row.getByRole('cell').nth(0)).toHaveText('#4');
    await expect(row.getByRole('cell').nth(1)).toHaveText('عميل أكيلة');
    await expect(
      row.getByRole('img', { name: 'بريد غير موثّق', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'بريد موثّق', exact: true }).first(),
    ).toBeVisible();
    const geometry = await row.locator('.email-cell').evaluate((cell) => {
      const email = cell.querySelector('bdi')!.getBoundingClientRect();
      const badge = cell
        .querySelector('.email-verification')!
        .getBoundingClientRect();
      return { gap: email.left - badge.right, height: badge.height };
    });
    expect(geometry.gap).toBeGreaterThanOrEqual(7);
    expect(geometry.height).toBeGreaterThan(20);
    expect(await row.locator('.email-verification').textContent()).toBe('');
    const button = row.getByRole('button', { name: 'عرض الحساب' });
    const border = await button.evaluate((element) => ({
      radius: getComputedStyle(element).borderRadius,
      color: getComputedStyle(element).borderColor,
    }));
    await expect(row.locator('.email-verification')).toHaveCSS(
      'border-radius',
      border.radius,
    );
    await expect(row.locator('.email-verification')).toHaveCSS(
      'border-color',
      border.color,
    );
    const select = page.getByLabel('نوع الحساب', { exact: true });
    const style = await select.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        arrow: style.backgroundImage,
        position: style.backgroundPosition,
        endPadding: parseFloat(style.paddingInlineEnd),
      };
    });
    expect(style.arrow).not.toBe('none');
    expect(style.position).toContain('12px');
    expect(style.endPadding).toBeGreaterThanOrEqual(36);
    await page.screenshot({
      path: join(tmpdir(), `akeela-admin-user-details-${width}.png`),
      fullPage: true,
    });
    await Promise.all([
      page.waitForRequest(
        (request) =>
          new URL(request.url()).searchParams.get('role') === 'Customer',
      ),
      select.selectOption('Customer'),
    ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
}
