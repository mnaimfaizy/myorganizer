import { expect, test } from '@playwright/test';
import { colorPrimary, colorSurface } from '@myorganiser/design-tokens';

/**
 * E2E tests for the web app manifest contract and generated icons.
 *
 * Verifies:
 * - GET /manifest.webmanifest returns the PWA manifest with correct metadata
 * - All icon files referenced in the manifest are accessible and valid
 * - The Apple touch icon link is present in the HTML head and is accessible
 */

test.describe('Web App Manifest', () => {
  test('should serve manifest with correct metadata and valid icon files', async ({
    page,
  }) => {
    // Fetch the manifest
    const res = await page.request.get('/manifest.webmanifest');

    // Assert response status and content-type
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain(
      'application/manifest+json',
    );

    // Parse and validate manifest
    const manifest = (await res.json()) as Record<string, unknown>;

    // Assert exact values
    expect(manifest.id).toBe('/');
    expect(manifest.name).toBe('MyOrganiser');
    expect(manifest.short_name).toBe('MyOrganiser');
    expect(manifest.start_url).toBe('/dashboard');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe(colorSurface);
    expect(manifest.theme_color).toBe(colorPrimary);

    // Assert description is a non-empty string
    expect(typeof manifest.description).toBe('string');
    expect((manifest.description as string).length).toBeGreaterThan(0);

    // Assert icons array structure and content
    const icons = manifest.icons as Array<{
      src: string;
      sizes: string;
      type: string;
      purpose?: string;
    }>;
    expect(icons).toHaveLength(3);

    // Find and validate each icon by src
    const icon192 = icons.find((icon) => icon.src === '/icons/icon-192.png');
    expect(icon192).toBeDefined();
    expect(icon192?.sizes).toBe('192x192');
    expect(icon192?.type).toBe('image/png');
    expect(icon192?.purpose).toBeUndefined();

    const icon512 = icons.find((icon) => icon.src === '/icons/icon-512.png');
    expect(icon512).toBeDefined();
    expect(icon512?.sizes).toBe('512x512');
    expect(icon512?.type).toBe('image/png');
    expect(icon512?.purpose).toBeUndefined();

    const iconMaskable = icons.find(
      (icon) => icon.src === '/icons/icon-512-maskable.png',
    );
    expect(iconMaskable).toBeDefined();
    expect(iconMaskable?.sizes).toBe('512x512');
    expect(iconMaskable?.type).toBe('image/png');
    expect(iconMaskable?.purpose).toBe('maskable');

    // Verify each icon file is accessible and is a valid PNG
    for (const icon of icons) {
      const iconRes = await page.request.get(icon.src);
      expect(iconRes.status()).toBe(200);
      expect(iconRes.headers()['content-type']).toMatch(/^image\/png/);

      const body = await iconRes.body();
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test('should include Apple touch icon link in HTML head', async ({
    page,
  }) => {
    // Navigate to the home page
    await page.goto('/');

    // Find the Apple touch icon link
    const appleIcon = page.locator('link[rel="apple-touch-icon"]');

    // Get the href attribute
    const href = await appleIcon.getAttribute('href');
    expect(href).toBe('/icons/apple-touch-icon.png');

    // Verify the icon file is accessible and is a valid PNG
    const iconRes = await page.request.get(href as string);
    expect(iconRes.status()).toBe(200);
    expect(iconRes.headers()['content-type']).toMatch(/^image\/png/);

    const body = await iconRes.body();
    expect(body.length).toBeGreaterThan(0);
  });
});
