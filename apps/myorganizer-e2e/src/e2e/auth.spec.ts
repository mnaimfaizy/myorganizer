import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow a user to log in', async ({ page }, testInfo) => {
    test.setTimeout(60000);

    // Mock the login API request (including CORS + preflight)
    const loginUrl = /\/auth\/login\/?(\?.*)?$/;

    let sawLoginRequest = false;

    await page.route(loginUrl, async (route) => {
      sawLoginRequest = true;
      const request = route.request();

      const origin = new URL(page.url() || 'http://localhost:3000').origin;
      const corsHeaders = {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization',
      };

      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      const json = {
        token: 'fake-jwt-token',
        expires_in: 3600,
        user: {
          id: '1',
          name: 'Test User',
          email: 'testuser@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      };

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: 'application/json',
        body: JSON.stringify(json),
      });
    });

    // Navigate to the login page
    await page.goto('/login');

    // Check if we are on the login page
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h1')).toContainText('Login');

    // Give the app time to hydrate and attach event handlers.
    await page.waitForLoadState('networkidle');
    if (testInfo.project.name === 'webkit') {
      // WebKit sometimes finishes network requests before the client-side app has fully hydrated
      // and wired up form event handlers, which can cause flaky failures when submitting the form.
      // This small, WebKit-only delay stabilizes the test until the underlying issue is resolved.
      await page.waitForTimeout(1500);
    }

    // Fill in the login form
    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'password123');

    // Submit the form
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect.poll(() => sawLoginRequest, { timeout: 60000 }).toBeTruthy();

    // Token should be stored (session or local)
    await page.waitForFunction(() => {
      const token =
        window.sessionStorage.getItem('myorganizer_access_token') ||
        window.localStorage.getItem('myorganizer_access_token');
      return Boolean(token);
    });

    // After login, the app should navigate to the dashboard.
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 60000 });
  });
});
