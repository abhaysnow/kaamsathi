import { expect, type Page } from '@playwright/test';

/** Signs in through the real login form with the prefilled demo credentials. */
export async function signInAsDemo(page: Page) {
  await page.goto('/login');
  await expect(page.getByTestId('login-email')).toHaveValue('demo@workwise.ai');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('greeting')).toBeVisible();
}
