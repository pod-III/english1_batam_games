const { test, expect } = require('@playwright/test');

test('Teacher Hub main menu loads', async ({ page }) => {
  await page.goto('/');
  // Verifies the main index.html loads successfully
  await expect(page.locator('body')).toBeVisible();
});

test('Bingo game loads correctly', async ({ page }) => {
  await page.goto('/games/bingo/index.html');
  // Checks that the Bingo game page renders without crashing
  await expect(page.locator('body')).toBeVisible();
});