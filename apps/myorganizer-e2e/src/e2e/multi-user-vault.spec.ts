import { expect, test, type Page } from '@playwright/test';
import {
  gotoStable,
  readOwnedVault,
  routeApi,
  waitForOwnedVault,
  UNCLAIMED_VAULT_KEY,
} from './helpers';

/**
 * Multi-user vault isolation tests.
 *
 * NOTE: Criterion 2 is proven client-side only. These tests run the mock backend
 * in the test process, so assertions over the mock's state only prove the client
 * sends the right ciphertext under the right identity. They do not prove that a
 * real server would refuse a cross-User request. Server-side identity verification
 * is tracked separately in issue #505.
 */

const USER_A_ID = 'a-1';
const USER_B_ID = 'b-2';

// Test credentials (10–15 char passphrases for hook compliance)
const ALICE_EMAIL = 'alice@example.com';
const ALICE_PASSWORD = 'alice-e2e-pw';
const ALICE_VAULT_PASSPHRASE = 'vault-pass-a';

const BOB_EMAIL = 'bob@example.com';
const BOB_PASSWORD = 'bob-e2e-pw';
const BOB_VAULT_PASSPHRASE = 'vault-pass-b';

const USER_A_ADDRESS = '123 Main St';
const USER_B_ADDRESS = '456 Oak Ave';

/**
 * Map a submitted email to one of the two Users this spec signs in as.
 *
 * Throws on anything else. An unrecognised email previously fell through to
 * User A, which silently gave both Users the same id and made every isolation
 * assertion in this file compare a User against themselves.
 */
function identityForEmail(email: string | undefined): {
  userId: string;
  userName: string;
} {
  if (email?.includes('alice')) return { userId: USER_A_ID, userName: 'Alice' };
  if (email?.includes('bob')) return { userId: USER_B_ID, userName: 'Bob' };
  throw new Error(
    `Unrecognised e2e login email: ${JSON.stringify(email)}. ` +
      'The stub only knows the alice and bob fixtures.',
  );
}

function corsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,if-match',
  } as const;
}

interface ServerState {
  meta: Record<string, unknown | null>;
  metaEtag: Record<string, string>;
  metaUpdatedAt: Record<string, string>;
  blobs: Record<string, Record<string, unknown | null>>;
  blobEtags: Record<string, Record<string, string>>;
  blobUpdatedAt: Record<string, Record<string, string>>;
}

function setupBackend(page: Page) {
  const serverState: ServerState = {
    meta: {},
    metaEtag: {},
    metaUpdatedAt: {},
    blobs: {},
    blobEtags: {},
    blobUpdatedAt: {},
  };

  const headersFor = (origin: string) => corsHeaders(origin);
  const loginUrl = /\/auth\/login\/?(\?.*)?$/;
  const registerUrl = /\/auth\/register\/?(\?.*)?$/;
  const logoutUrl = /\/auth\/logout\/([a-zA-Z0-9-]+)\/?(\?.*)?$/;
  const vaultMetaUrl = /\/vault\/?(\?.*)?$/;
  const vaultBlobUrl =
    /\/vault\/blob\/(addresses|mobileNumbers|subscriptions|todos)\/?(\?.*)?$/;
  const vaultBackupsLatestUrl = /\/vault\/backups\/latest\/?(\?.*)?$/;

  routeApi(page, loginUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    // The generated client sends UserLoginBody as the request body itself
    // (api.ts: `localVarRequestOptions.data = serializeDataIfNeeded(userLoginBody, ...)`),
    // so the payload is flat — not wrapped in `userLoginBody`.
    const body = (request.postDataJSON?.() ?? {}) as {
      email?: string;
      password?: string;
    };
    const identity = identityForEmail(body.email);

    await route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        token: `e2e-token:${identity.userId}`,
        expires_in: 3600,
        user: {
          id: identity.userId,
          name: identity.userName,
          email: body.email ?? '',
          firstName: identity.userName,
          lastName: 'User',
        },
      }),
    });
  });

  routeApi(page, registerUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    const body = (request.postDataJSON?.() ?? {}) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
    };
    const identity = identityForEmail(body.email);

    await route.fulfill({
      status: 201,
      headers,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Registration successful. Please verify your email.',
        user: {
          id: identity.userId,
          name: identity.userName,
          email: body.email ?? '',
          firstName: body.firstName,
          lastName: body.lastName,
        },
      }),
    });
  });

  routeApi(page, logoutUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (request.method() === 'POST') {
      await route.fulfill({ status: 204, headers });
    } else {
      await route.fulfill({ status: 405, headers });
    }
  });

  routeApi(page, vaultMetaUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    // `/dashboard/vault` also matches the vault URL patterns, so a page
    // navigation would otherwise be served this stub's JSON instead of the
    // app. Only API calls belong here; let documents reach Next.js.
    if (request.resourceType() === 'document') {
      await route.fallback();
      return;
    }

    const authHeader = request.headers()['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');
    const userId = token.split(':')[1];

    if (!userId) {
      await route.fulfill({
        status: 401,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid token format' }),
      });
      return;
    }

    if (request.method() === 'GET') {
      const meta = serverState.meta[userId];
      if (!meta) {
        await route.fulfill({
          status: 404,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          meta,
          etag: serverState.metaEtag[userId],
          updatedAt: serverState.metaUpdatedAt[userId],
        }),
      });
    } else if (request.method() === 'PUT') {
      const body = (request.postDataJSON?.() ?? {}) as { meta?: unknown };
      serverState.meta[userId] = body.meta ?? null;
      serverState.metaUpdatedAt[userId] = new Date().toISOString();
      serverState.metaEtag[userId] = `W/"${Date.now()}"`;
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          etag: serverState.metaEtag[userId],
          updatedAt: serverState.metaUpdatedAt[userId],
        }),
      });
    } else {
      await route.fulfill({ status: 405, headers });
    }
  });

  routeApi(page, vaultBlobUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

    const match = request
      .url()
      .match(/\/vault\/blob\/(addresses|mobileNumbers|subscriptions|todos)/);
    const type = match?.[1];

    if (!type) {
      await route.fulfill({ status: 400, headers });
      return;
    }

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }

    // `/dashboard/vault` also matches the vault URL patterns, so a page
    // navigation would otherwise be served this stub's JSON instead of the
    // app. Only API calls belong here; let documents reach Next.js.
    if (request.resourceType() === 'document') {
      await route.fallback();
      return;
    }

    const authHeader = request.headers()['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');
    const userId = token.split(':')[1];

    if (!userId) {
      await route.fulfill({
        status: 401,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid token format' }),
      });
      return;
    }

    if (!serverState.blobs[userId]) {
      serverState.blobs[userId] = {};
      serverState.blobEtags[userId] = {};
      serverState.blobUpdatedAt[userId] = {};
    }

    if (request.method() === 'GET') {
      const blob = serverState.blobs[userId][type];
      if (!blob) {
        await route.fulfill({
          status: 404,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          type,
          blob,
          etag: serverState.blobEtags[userId][type],
          updatedAt: serverState.blobUpdatedAt[userId][type],
        }),
      });
    } else if (request.method() === 'PUT') {
      const body = (request.postDataJSON?.() ?? {}) as { blob?: unknown };
      serverState.blobs[userId][type] = body.blob ?? null;
      serverState.blobUpdatedAt[userId][type] = new Date().toISOString();
      serverState.blobEtags[userId][type] = `W/"${Date.now()}"`;
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          etag: serverState.blobEtags[userId][type],
          updatedAt: serverState.blobUpdatedAt[userId][type],
        }),
      });
    } else {
      await route.fulfill({ status: 405, headers });
    }
  });

  routeApi(page, vaultBackupsLatestUrl, async (route) => {
    const request = route.request();
    const origin = new URL(page.url() || 'http://localhost:3000').origin;
    const headers = headersFor(origin);

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
    } else if (request.method() === 'GET') {
      await route.fulfill({
        status: 404,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    } else {
      await route.fulfill({ status: 405, headers });
    }
  });
}

async function unlockWithPassphrase(page: Page, passphrase: string) {
  const savedRecoveryKey = page.getByRole('button', { name: 'I saved it' });
  if (await savedRecoveryKey.isVisible({ timeout: 1000 }).catch(() => false)) {
    await savedRecoveryKey.click();
  }

  const usePassphrase = page.getByRole('button', { name: 'Use passphrase' });
  if (await usePassphrase.isVisible({ timeout: 1000 }).catch(() => false)) {
    await usePassphrase.click();
  }

  const input = page.locator('#unlock-passphrase');
  if ((await input.count()) === 0) return;

  await expect(input).toBeVisible({ timeout: 60000 });
  await input.fill(passphrase);
  await page.waitForTimeout(50);
  await page.getByRole('button', { name: /^Unlock$/i }).click();
  await expect(page.locator('#unlock-passphrase')).toHaveCount(0, {
    timeout: 120000,
  });
}

async function signOut(page: Page) {
  // NavUser is the only sidebar menu-button in the header — NavMain's live in
  // SidebarContent — so this scopes to the account trigger without depending on
  // the signed-in User's name. Radix portals the content, so open, then query.
  const trigger = page.locator(
    '[data-sidebar="header"] [data-sidebar="menu-button"]',
  );
  await expect(trigger).toBeVisible({ timeout: 30000 });
  await trigger.click();

  const content = page.getByRole('menuitem', { name: 'Log out' });
  await expect(content).toBeVisible({ timeout: 10000 });
  await content.click();

  await expect(page).toHaveURL(/.*login/, { timeout: 30000 });
}

async function login(
  page: Page,
  email: string,
  password: string,
  options?: { webkitDelayMs?: number },
) {
  await gotoStable(page, '/login');
  await expect(page).toHaveURL(/.*login/);

  await page.waitForLoadState('networkidle');
  if (options?.webkitDelayMs) {
    await page.waitForTimeout(options.webkitDelayMs);
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page).toHaveURL(/.*dashboard/, { timeout: 60000 });
  await page.waitForLoadState('networkidle');
  if (options?.webkitDelayMs) {
    await page.waitForTimeout(options.webkitDelayMs);
  }
}

async function signUp(
  page: Page,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
) {
  await gotoStable(page, '/signup');
  await expect(page).toHaveURL(/.*signup/);

  // Wait on the form itself, not on network quiet: `networkidle` is
  // DISCOURAGED by Playwright and hangs here against a production build
  // (ADR 0050, issue #524).
  await expect(page.getByLabel('First name')).toBeVisible({ timeout: 30000 });

  await page.getByLabel('First name').fill(firstName);
  await page.getByLabel('Last name').fill(lastName);
  await page.getByLabel('Email').fill(email);
  // `exact` is required on both: getByLabel also matches aria-label, and the
  // show/hide eye buttons are labelled "Show password" / "Show confirm password",
  // which contain these strings as substrings.
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);

  // Check terms checkbox
  const termsCheckbox = page.locator('form').getByRole('checkbox').first();
  await termsCheckbox.check();

  // Submit form
  const submitButton = page.getByRole('button', { name: 'Create account' });
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  // Wait for navigation to email verification page
  await expect(page).toHaveURL(/.*verify.*sent/, { timeout: 60000 });
}

async function createAndUnlockVault(
  page: Page,
  owner: string,
  passphrase: string,
) {
  const setupPass = page.locator('#setup-passphrase');
  await expect(setupPass).toBeVisible({ timeout: 60000 });
  await setupPass.fill(passphrase);

  const confirmPass = page.locator('#setup-confirm');
  await expect(confirmPass).toBeVisible();
  await confirmPass.fill(passphrase);

  const createButton = page.getByRole('button', {
    name: 'Create encrypted vault',
  });
  await expect(createButton).toBeEnabled();
  await createButton.click();

  const savedButton = page.getByRole('button', { name: 'I saved it' });
  await expect(savedButton).toBeVisible({ timeout: 60000 });
  await savedButton.click();

  // The stored owned record is the real completion signal for PBKDF2 —
  // not the auth user, which was already present from sign-in.
  await waitForOwnedVault(page, owner);

  // VaultGate deliberately does not auto-unlock after creation; "I saved it"
  // advances to 'owned', which renders the unlock panel. Require that panel to
  // appear rather than letting a tolerant unlock helper skip silently.
  await expect(page.locator('#unlock-passphrase')).toBeVisible({
    timeout: 60000,
  });
  await unlockWithPassphrase(page, passphrase);
  await expect(page.locator('#unlock-passphrase')).toHaveCount(0, {
    timeout: 120000,
  });
}

/**
 * Bring the gate to its unlocked state on the current page.
 *
 * `masterKeyBytes` lives only in `VaultSessionProvider`'s React state, so every
 * full page load re-locks the Vault. Any navigation that lands on a
 * VaultGate-wrapped route therefore has to unlock again before the route's own
 * content exists.
 */
async function ensureUnlocked(page: Page, passphrase: string) {
  const usePassphrase = page.getByRole('button', { name: 'Use passphrase' });
  if (await usePassphrase.isVisible({ timeout: 2000 }).catch(() => false)) {
    await usePassphrase.click();
  }

  const input = page.locator('#unlock-passphrase');
  if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
    await input.fill(passphrase);
    await page.getByRole('button', { name: /^Unlock$/i }).click();
    await expect(input).toHaveCount(0, { timeout: 120000 });
  }
}

/**
 * Write one address into the signed-in User's Vault, through the real form.
 *
 * Selectors are the ones `vault.spec.ts` already drives successfully. Every
 * step asserts: a helper that silently skips a field would let an isolation
 * test pass while writing nothing at all, which is worse than failing.
 *
 * `address` is rendered by the list as "<property> <street>", so it is split
 * on the first space to match how the caller asserts on it later.
 */
async function writeAddressToVault(
  page: Page,
  address: string,
  passphrase: string,
) {
  const [property, ...streetParts] = address.split(' ');
  const street = streetParts.join(' ');

  await gotoStable(page, '/dashboard/addresses');
  await expect(page).toHaveURL(/.*addresses/, { timeout: 30000 });
  await ensureUnlocked(page, passphrase);

  await page.getByRole('button', { name: 'Add address' }).first().click();
  await expect(page.getByLabel('Label')).toBeVisible({ timeout: 60000 });

  await page.getByLabel('Label').fill('Home');
  await page.fill('#addr-property', property);
  await page.fill('#addr-street', street);
  await page.fill('#addr-suburb', 'London');
  await page.fill('#addr-state', 'Greater London');
  await page.fill('#addr-zipcode', 'NW1');
  await page.locator('#addr-country').click();
  await page.getByText('United Kingdom (GB)').click();

  const saveAddress = page.getByRole('button', { name: 'Save address' });
  await expect(saveAddress).toBeEnabled({ timeout: 60000 });
  await saveAddress.click();

  // The dialog is a wizard — Details, Review, Saved — and its final step does
  // not dismiss itself. Confirm the save on that step, then close it.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Address saved')).toBeVisible({
    timeout: 60000,
  });
  await dialog.getByRole('button', { name: 'Close' }).click();

  // The overlay is `fixed inset-0 z-50` and swallows pointer events, so
  // anything clicked while it lingers — sign-out in particular — times out
  // while reporting itself visible. Asserting the address text before the
  // dialog closes also matches the dialog's own confirmation panel, which is
  // not evidence of a saved row in the list.
  await expect(dialog).toHaveCount(0, { timeout: 60000 });

  // The rendered list entry is the completion signal — encryption and the
  // vault write have both finished by the time it appears.
  await expect(page.getByText(address).first()).toBeVisible({ timeout: 60000 });
}

test.describe('Multi-user vault isolation (E2E)', () => {
  test('Test 1: User A creates vault, User B signs up and cannot access A vault', async ({
    browser,
  }) => {
    test.setTimeout(180000);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page);

    // Test criteria 1 and 2: User A creates vault, User B cannot access it
    // A: Login, create vault, unlock, write address
    await login(page, ALICE_EMAIL, ALICE_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');

    // User A creates vault with passphrase
    await createAndUnlockVault(page, USER_A_ID, ALICE_VAULT_PASSPHRASE);

    // Write User A's address
    await writeAddressToVault(page, USER_A_ADDRESS, ALICE_VAULT_PASSPHRASE);

    // Capture User A's vault ciphertext
    await waitForOwnedVault(page, USER_A_ID);
    const userAVault = await readOwnedVault(page, USER_A_ID);
    expect(userAVault).toBeTruthy();

    // User A signs out
    await signOut(page);

    // User B signs up
    await signUp(page, 'Bob', 'User', BOB_EMAIL, BOB_PASSWORD);

    // After signup, user is redirected to email verification
    // Now login as User B
    await login(page, BOB_EMAIL, BOB_PASSWORD);

    // User B visits a VaultGate route
    await gotoStable(page, '/dashboard/addresses');

    // Criterion 1: User B should see the CREATE vault panel, not unlock
    // Assert the setup form is visible (create passphrase input)
    const setupPass = page.locator('#setup-passphrase');
    await expect(setupPass).toBeVisible({ timeout: 30000 });

    // Criterion 2: No unlock form should be present
    const unlockPass = page.locator('#unlock-passphrase');
    await expect(unlockPass).toHaveCount(0);

    // User B creates their own vault with different passphrase
    await createAndUnlockVault(page, USER_B_ID, BOB_VAULT_PASSPHRASE);

    // Write User B's address
    await writeAddressToVault(page, USER_B_ADDRESS, BOB_VAULT_PASSPHRASE);

    // Capture User B's vault ciphertext
    await waitForOwnedVault(page, USER_B_ID);
    const userBVault = await readOwnedVault(page, USER_B_ID);
    expect(userBVault).toBeTruthy();

    // Verify isolation: the two ciphertexts are different
    expect(userAVault).not.toBe(userBVault);

    await ctx.close();
  });

  test('Test 2: Both Users sign in/out twice; sign-out preserves vault storage', async ({
    browser,
  }) => {
    test.setTimeout(180000);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page);

    // Test criteria 3 and 4: Sign in/out cycles preserve vault storage and return to correct unlock state

    // === Cycle 1: User A ===
    await login(page, ALICE_EMAIL, ALICE_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');
    await createAndUnlockVault(page, USER_A_ID, ALICE_VAULT_PASSPHRASE);
    await writeAddressToVault(page, USER_A_ADDRESS, ALICE_VAULT_PASSPHRASE);

    await waitForOwnedVault(page, USER_A_ID);
    const userAVaultCycle1 = await readOwnedVault(page, USER_A_ID);
    expect(userAVaultCycle1).toBeTruthy();

    // User A signs out
    await signOut(page);

    // Verify vault storage persists after sign-out
    const userAVaultAfterSignOut = await readOwnedVault(page, USER_A_ID);
    expect(userAVaultAfterSignOut).toBe(userAVaultCycle1);

    // === Cycle 1: User B ===
    await login(page, BOB_EMAIL, BOB_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');
    await createAndUnlockVault(page, USER_B_ID, BOB_VAULT_PASSPHRASE);
    await writeAddressToVault(page, USER_B_ADDRESS, BOB_VAULT_PASSPHRASE);

    await waitForOwnedVault(page, USER_B_ID);
    const userBVaultCycle1 = await readOwnedVault(page, USER_B_ID);
    expect(userBVaultCycle1).toBeTruthy();

    // User B signs out
    await signOut(page);

    // Verify vault storage persists after sign-out
    const userBVaultAfterSignOut = await readOwnedVault(page, USER_B_ID);
    expect(userBVaultAfterSignOut).toBe(userBVaultCycle1);

    // === Cycle 2: User A signs back in ===
    await login(page, ALICE_EMAIL, ALICE_PASSWORD);

    // User A's vault should be unchanged
    const userAVaultCycle2 = await readOwnedVault(page, USER_A_ID);
    expect(userAVaultCycle2).toBe(userAVaultCycle1);

    // Navigate to vault route — should see unlock panel, not create
    await gotoStable(page, '/dashboard/addresses');
    const unlockPass = page.locator('#unlock-passphrase');
    await expect(unlockPass).toBeVisible({ timeout: 30000 });

    // Unlock User A's vault
    await unlockWithPassphrase(page, ALICE_VAULT_PASSPHRASE);

    // User A should see their own address
    const userAAddressVisible = page.locator(`text=${USER_A_ADDRESS}`);
    await expect(userAAddressVisible).toBeVisible({ timeout: 10000 });

    // User B's address should not be visible
    const userBAddressLocator = page.locator(`text=${USER_B_ADDRESS}`);
    await expect(userBAddressLocator).toHaveCount(0);

    await signOut(page);

    // === Cycle 2: User B signs back in ===
    await login(page, BOB_EMAIL, BOB_PASSWORD);

    // User B's vault should be unchanged
    const userBVaultCycle2 = await readOwnedVault(page, USER_B_ID);
    expect(userBVaultCycle2).toBe(userBVaultCycle1);

    // Navigate to vault route — should see unlock panel
    await gotoStable(page, '/dashboard/addresses');
    const unlockPassB = page.locator('#unlock-passphrase');
    await expect(unlockPassB).toBeVisible({ timeout: 30000 });

    // Unlock User B's vault
    await unlockWithPassphrase(page, BOB_VAULT_PASSPHRASE);

    // User B should see their own address
    const userBAddressVisible = page.locator(`text=${USER_B_ADDRESS}`);
    await expect(userBAddressVisible).toBeVisible({ timeout: 10000 });

    // User A's address should not be visible
    const userAAddressLocator = page.locator(`text=${USER_A_ADDRESS}`);
    await expect(userAAddressLocator).toHaveCount(0);

    await ctx.close();
  });

  test('Test 3: Unclaimed vault claim with wrong then correct passphrase', async ({
    browser,
  }) => {
    test.setTimeout(180000);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page);

    // Test criterion 5: Claim unclaimed vault with wrong then correct passphrase

    // Step 1: Create an owned vault as User A to get the inner vault object
    await login(page, ALICE_EMAIL, ALICE_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');
    await createAndUnlockVault(page, USER_A_ID, ALICE_VAULT_PASSPHRASE);
    await writeAddressToVault(page, USER_A_ADDRESS, ALICE_VAULT_PASSPHRASE);

    // Read the owned vault record (structured as { version, owner, vault })
    await waitForOwnedVault(page, USER_A_ID);
    const ownedRecord = await readOwnedVault(page, USER_A_ID);
    expect(ownedRecord).toBeTruthy();

    // Extract the inner vault object and write to unclaimed slot
    await page.evaluate(
      ({ unclaimedKey, ownedData }) => {
        const parsed = JSON.parse(ownedData);
        // The stored structure is { version: 2, owner, vault }
        const vaultObject = parsed.vault;
        window.localStorage.setItem(unclaimedKey, JSON.stringify(vaultObject));
      },
      {
        unclaimedKey: UNCLAIMED_VAULT_KEY,
        ownedData: ownedRecord || '{}',
      },
    );

    // Verify unclaimed slot now has the vault
    const unclaimedVaultBefore = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      UNCLAIMED_VAULT_KEY,
    );
    expect(unclaimedVaultBefore).toBeTruthy();

    await signOut(page);

    // Step 2: Sign in as User B (who has no vault)
    await login(page, BOB_EMAIL, BOB_PASSWORD);

    // Navigate to vault route to trigger VaultGate
    await gotoStable(page, '/dashboard/addresses');

    // Claim offer should appear
    const claimTitle = page.locator('text="A vault is already on this device"');
    await expect(claimTitle).toBeVisible({ timeout: 30000 });

    // Step 3: Attempt claim with WRONG passphrase
    const claimPassphrase = page.locator('#claim-passphrase');
    await expect(claimPassphrase).toBeVisible();
    await claimPassphrase.fill('wrong-pass-99');

    const unlockButton = page.getByRole('button', {
      name: /^Unlock this vault$/i,
    });
    await expect(unlockButton).toBeVisible();
    await expect(unlockButton).toBeEnabled();
    await unlockButton.click();

    // Assert destructive toast appears
    const errorToast = page.locator(
      'text="That passphrase didn\'t unlock this vault"',
    );
    await expect(errorToast).toBeVisible({ timeout: 10000 });

    // Verify User B has no owned vault (claim failed)
    const userBOwnedAfterWrongClaim = await readOwnedVault(page, USER_B_ID);
    expect(userBOwnedAfterWrongClaim).toBeNull();

    // Verify unclaimed slot still exists and is unchanged
    const unclaimedVaultAfterWrongClaim = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      UNCLAIMED_VAULT_KEY,
    );
    expect(unclaimedVaultAfterWrongClaim).toBe(unclaimedVaultBefore);

    // Step 4: Attempt claim with CORRECT passphrase
    const claimPassphrase2 = page.locator('#claim-passphrase');
    await claimPassphrase2.fill(ALICE_VAULT_PASSPHRASE);

    await unlockButton.click();

    // Verify claim succeeds
    const successToast = page.locator('text="Vault claimed"');
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Verify User B now has owned vault
    await waitForOwnedVault(page, USER_B_ID);
    const userBOwnedAfterCorrectClaim = await readOwnedVault(page, USER_B_ID);
    expect(userBOwnedAfterCorrectClaim).toBeTruthy();

    // Verify unclaimed slot still exists and is unchanged (per ADR 0033)
    const unclaimedVaultAfterCorrectClaim = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      UNCLAIMED_VAULT_KEY,
    );
    expect(unclaimedVaultAfterCorrectClaim).toBe(unclaimedVaultBefore);

    await ctx.close();
  });

  test('Test 4: Remove owned vault for User A; User B vault unchanged', async ({
    browser,
  }) => {
    test.setTimeout(180000);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    setupBackend(page);

    // Test criterion 6: Removing User A's vault does not affect User B's vault

    // Step 1: Create vaults for both users
    await login(page, ALICE_EMAIL, ALICE_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');
    await createAndUnlockVault(page, USER_A_ID, ALICE_VAULT_PASSPHRASE);
    await writeAddressToVault(page, USER_A_ADDRESS, ALICE_VAULT_PASSPHRASE);

    await waitForOwnedVault(page, USER_A_ID);
    const userAVaultBefore = await readOwnedVault(page, USER_A_ID);
    expect(userAVaultBefore).toBeTruthy();

    await signOut(page);

    // Create User B's vault
    await login(page, BOB_EMAIL, BOB_PASSWORD);
    await gotoStable(page, '/dashboard/addresses');
    await createAndUnlockVault(page, USER_B_ID, BOB_VAULT_PASSPHRASE);
    await writeAddressToVault(page, USER_B_ADDRESS, BOB_VAULT_PASSPHRASE);

    await waitForOwnedVault(page, USER_B_ID);
    const userBVaultBefore = await readOwnedVault(page, USER_B_ID);
    expect(userBVaultBefore).toBeTruthy();

    await signOut(page);

    // Step 2: Sign back in as User A and remove vault
    await login(page, ALICE_EMAIL, ALICE_PASSWORD);
    await gotoStable(page, '/dashboard/vault');

    // Find and click the remove vault button
    const removeButton = page.getByTestId('remove-vault-button');
    await expect(removeButton).toBeVisible({ timeout: 10000 });
    await removeButton.click();

    // Confirmation dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Click Delete button in the dialog
    const deleteButton = dialog.getByRole('button', { name: 'Delete' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // RemoveVaultCard triggers window.location.reload() after removal
    // Wait for the reload to complete
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify User A's vault was removed
    const userAVaultAfterRemoval = await readOwnedVault(page, USER_A_ID);
    expect(userAVaultAfterRemoval).toBeNull();

    // Verify User B's vault is unchanged
    const userBVaultAfterARemoval = await readOwnedVault(page, USER_B_ID);
    expect(userBVaultAfterARemoval).toBe(userBVaultBefore);

    await ctx.close();
  });
});
