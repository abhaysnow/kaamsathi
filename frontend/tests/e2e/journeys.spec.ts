import { expect, test, type Page } from '@playwright/test';
import { signInAsDemo } from './helpers';

/**
 * Critical worker journeys against the real backend running the MOCK AI provider and in-memory
 * storage. Each test gets a fresh browser context and signs in to the demo account, which gives
 * it a fresh private sandbox of fictional data.
 */
test.beforeEach(async ({ page }) => {
  await signInAsDemo(page);
});

const rupeesToNumber = (s: string) => Number(s.replace(/[^\d.-]/g, ''));

async function chooseLanguage(page: Page, code: string) {
  await page
    .getByRole('combobox', { name: /Language|भाषा|ਭਾਸ਼ਾ/ })
    .first()
    .selectOption(code);
}

test('1. the demo account is clearly labelled as demo', async ({ page }) => {
  await expect(page.getByTestId('mode-banner')).toContainText('DEMO MODE');
  await expect(page.getByTestId('home-net')).toBeVisible();
});

test('2+3. select Hindi and ask the assistant a question', async ({ page }) => {
  await page.goto('/ask');
  await chooseLanguage(page, 'hi');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('काम साथी से पूछें');

  await page.getByTestId('chat-input').fill('Company ne meri payment rok di hai, ab kya karun?');
  await page.getByTestId('chat-send').click();

  const reply = page.getByTestId('assistant-msg').first();
  await expect(reply).toBeVisible();
  // Mock replies are labelled as mock, never as a live model.
  await expect(reply.getByTestId('provider-badge')).toContainText('डेमो AI');
  // Rights answers carry citations to official sources.
  const link = reply.getByTestId('citations').getByRole('link').first();
  await expect(link).toHaveAttribute('href', /^https:\/\/[a-z.]*gov\.in/);
});

test('emergency questions always show the 112 banner', async ({ page }) => {
  await page.goto('/ask');
  await page.getByTestId('chat-input').fill('Mujhe accident ho gaya. Ab mujhe kya karna chahiye?');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('assistant-msg').getByRole('alert')).toContainText('112');
});

test('4. add an earnings entry and see the summary update', async ({ page }) => {
  await page.goto('/earnings');
  const net = page.getByTestId('net');
  await expect(net).toBeVisible();
  const before = rupeesToNumber(await net.innerText());

  await page.getByTestId('f-basePay').fill('1000');
  await page.getByTestId('f-expenses').fill('200');
  await page.getByTestId('save-entry').click();

  // Net = 1000 base − 200 expenses = +800 for today's entry (inside "this week").
  await expect.poll(async () => rupeesToNumber(await net.innerText())).toBe(before + 800);
  await expect(
    page.getByText('You entered').or(page.getByText('Demo sample')).first(),
  ).toBeVisible();
});

test('5. search welfare schemes and see official sources', async ({ page }) => {
  await page.goto('/schemes');
  await page.getByTestId('s-state').selectOption('Punjab');
  await page.getByTestId('s-search').click();

  const card = page.getByTestId('scheme-card').first();
  await expect(card).toBeVisible();
  await expect(card).toContainText('Potentially relevant — verify eligibility');
  await expect(card.getByRole('link', { name: /Open official site/ })).toHaveAttribute(
    'href',
    /^https:\/\//,
  );
  await expect(card.getByTestId('citations')).toContainText('link checked');
});

test('6. generate, edit and copy a complaint draft that keeps the worker facts', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/complaints');
  await page.getByTestId('load-sample').click();
  await page.getByTestId('c-next').click();

  const box = page.getByTestId('final-message');
  await expect(box).toBeVisible();
  const draft = await box.inputValue();
  expect(draft).toContain('250'); // amount the worker gave
  expect(draft).toContain('Demo Foods (fictional)');

  const edited = `${draft}\n\nEdited by worker: my ticket number is in the screenshot.`;
  await box.fill(edited);
  await page.getByTestId('copy-draft').click();
  await expect(page.getByTestId('copy-draft')).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(edited);
});

test('7a. AI provider outage shows a clear error with retry', async ({ page }) => {
  // Simulate the backend's real 503 contract for a provider outage.
  await page.route('**/api/v1/assistant/chat', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'AI_UNAVAILABLE', message: 'The AI service is not available' } },
    }),
  );
  await page.goto('/ask');
  await page.getByTestId('chat-input').fill('How can I raise a complaint against a platform?');
  await page.getByTestId('chat-send').click();

  const err = page.getByTestId('error-box');
  await expect(err).toContainText('The AI service is not available right now');
  await expect(err.getByRole('button', { name: 'Try again' })).toBeVisible();

  // Once the provider recovers, retry works.
  await page.unroute('**/api/v1/assistant/chat');
  await err.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('assistant-msg')).toBeVisible();
  await expect(page.getByTestId('error-box')).toHaveCount(0);
});

test('7b. network failure shows the offline message', async ({ page }) => {
  await page.route('**/api/v1/assistant/chat', (route) => route.abort('internetdisconnected'));
  await page.goto('/ask');
  await page.getByTestId('chat-input').fill('Maine aaj kitna kamaya?');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('error-box')).toContainText('offline');
});
