import { expect, test } from '@playwright/test';
import { signInAsDemo } from './helpers';

const API = 'http://localhost:4100/api/v1';

test('login form is prefilled with the demo account but never signs in by itself', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByTestId('demo-section')).toContainText('Demo account');
  await expect(page.getByTestId('login-email')).toHaveValue('demo@workwise.ai');
  await expect(page.getByTestId('login-password')).toHaveValue('WorkerDemo@2026');
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get(`${API}/auth/me`)).status()).toBe(401);
});

test('"Fill demo credentials" restores edited fields; show/hide toggles the password', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('someone@else.test');
  await page.getByTestId('login-password').fill('typed');
  await page.getByTestId('fill-demo').click();
  await expect(page.getByTestId('login-email')).toHaveValue('demo@workwise.ai');
  await expect(page.getByTestId('login-password')).toHaveValue('WorkerDemo@2026');

  await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password');
  await page.getByTestId('toggle-password').click();
  await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'text');
  await expect(page.getByTestId('toggle-password')).toHaveAttribute('aria-pressed', 'true');
});

test('inline validation errors appear and block submission', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('not-an-email');
  await page.getByTestId('login-password').fill('');
  await page.getByTestId('login-submit').click();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
  await expect(page.getByText('Enter your password')).toBeVisible();
  await expect(page.getByTestId('login-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/login$/);
});

test('wrong password shows a generic error and stays on the login page', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-password').fill('Wrong-pass-1');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('auth-error')).toContainText('Incorrect email or password.');
  await expect(page).toHaveURL(/\/login$/);
});

test('private pages redirect to login and come back after signing in', async ({ page }) => {
  await page.goto('/earnings');
  await expect(page).toHaveURL(/\/login\?next=%2Fearnings$/);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/earnings$/);
  await expect(page.getByTestId('net')).toBeVisible();
});

test('redirects to the dashboard only after the server confirms the session', async ({ page }) => {
  // Login "succeeds" but the confirmation call says otherwise: we must not navigate.
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 401, json: { error: { code: 'AUTH_REQUIRED', message: 'x' } } }),
  );
  await page.goto('/login');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('auth-error')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('dashboard shows the demo account and logout fully signs out', async ({ page }) => {
  await signInAsDemo(page);
  await expect(page.getByTestId('greeting')).toContainText('Demo Worker');
  await expect(page.getByTestId('mode-banner')).toContainText('Demo mode');
  await expect(page.getByTestId('account-name').first()).toContainText('Demo Worker');

  await page.getByTestId('logout').first().click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get(`${API}/auth/me`)).status()).toBe(401);
  expect((await page.request.get(`${API}/earnings/entries`)).status()).toBe(401);

  await page.goto('/complaints');
  await expect(page).toHaveURL(/\/login\?next=%2Fcomplaints$/);
});

test('a new account signs up, sees no demo data, and is not labelled demo', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Name').fill('Asha Kaur');
  await page.getByLabel('Email').fill(`asha-${Date.now()}@example.test`);
  await page.locator('input[autocomplete="new-password"]').fill('Strong-pass-9');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('greeting')).toContainText('Asha Kaur');
  await expect(page.getByTestId('mode-banner')).toContainText('My data');
  await page.goto('/earnings');
  await expect(page.getByTestId('earnings-empty')).toBeVisible();
});

test('forgot password gives the same generic answer and points developers to the outbox', async ({
  page,
}) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('nobody@example.test');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByTestId('auth-success')).toContainText('If an account exists');
  await expect(page.getByTestId('dev-outbox')).toContainText('DEVELOPMENT ONLY');
});
