const { test, expect } = require('@playwright/test');

test('Teacher Hub main menu loads', async ({ page }) => {
  await page.goto('http://localhost:3000/'); // or your app's correct URL
  // Verifies the main index.html loads successfully
  await expect(page.locator('body')).toBeVisible();
});

test('Bingo game loads correctly', async ({ page }) => {
  await page.goto('http://localhost:3000/games/bingo/index.html');
  // Checks that the Bingo game page renders without crashing
  await expect(page.locator('body')).toBeVisible();
});

