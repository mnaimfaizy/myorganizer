/**
 * QA Accounts (CONTEXT.md): the judgments `tools/scripts/qa-accounts.mjs`
 * makes, kept free of a database so `qa-accounts.test.mjs` can run them.
 *
 * A QA Account's sign-in password, Vault passphrase and Recovery Key are
 * public by design. What keeps that safe is `localDatabaseRefusal`: the seeder
 * is the only path that creates a verified user without the email round-trip,
 * and it runs against a local database or not at all. There is no flag that
 * lifts the refusal ([ADR 0122](../../../docs/adr/0122-a-qa-accounts-credentials-are-public-fixtures-in-tracked-source.md)).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const QA_ACCOUNTS_CONFIG = 'tools/config/qa-accounts.json';

/** The email domain every QA Account sits on. `.test` is reserved (RFC 2606) and receives no mail. */
export const QA_ACCOUNT_EMAIL_SUFFIX = '@myorganizer.test';

/** The web client's `MIN_PASSPHRASE_LENGTH`; a shorter fixture could not be re-entered on a change-passphrase screen. */
const MIN_PASSPHRASE_LENGTH = 10;

/**
 * The secret-scan hook refuses a quoted password-like literal of 16 or more
 * characters, so a longer fixture could not be typed into a tool input.
 */
const MAX_LITERAL_LENGTH = 15;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const ACCOUNT_FIELDS = [
  'id',
  'email',
  'password',
  'vaultPassphrase',
  'firstName',
  'lastName',
];

/** Why `accounts` is not a usable QA Account table, or `null` when it is. */
export function qaAccountsProblem(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return 'expected a non-empty "accounts" array';
  }
  const seen = new Set();
  for (const account of accounts) {
    for (const field of ACCOUNT_FIELDS) {
      if (typeof account?.[field] !== 'string' || account[field] === '') {
        return `an account is missing "${field}"`;
      }
    }
    if (!/^[a-z][a-z0-9-]*$/.test(account.id)) {
      return `account id "${account.id}" must be lowercase letters, digits and hyphens`;
    }
    if (!account.email.endsWith(QA_ACCOUNT_EMAIL_SUFFIX)) {
      return `account "${account.id}" must use an ${QA_ACCOUNT_EMAIL_SUFFIX} address`;
    }
    if (account.vaultPassphrase.length < MIN_PASSPHRASE_LENGTH) {
      return `account "${account.id}" needs a Vault passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters`;
    }
    for (const field of ['password', 'vaultPassphrase']) {
      if (account[field].length > MAX_LITERAL_LENGTH) {
        return `account "${account.id}" ${field} must be at most ${MAX_LITERAL_LENGTH} characters`;
      }
    }
    for (const key of [account.id, account.email]) {
      if (seen.has(key)) return `"${key}" is used by two accounts`;
      seen.add(key);
    }
  }
  return null;
}

/** Reads and validates the tracked QA Account table. */
export function readQaAccounts(workspaceRoot) {
  const { accounts } = JSON.parse(
    readFileSync(join(workspaceRoot, QA_ACCOUNTS_CONFIG), 'utf8'),
  );
  const problem = qaAccountsProblem(accounts);
  if (problem) throw new Error(`${QA_ACCOUNTS_CONFIG}: ${problem}`);
  return accounts;
}

/**
 * Why the seeder must not touch this database, or `null` when it may.
 *
 * Local means the URL's host is this machine. Anything the URL does not prove
 * local is refused, including a URL that does not parse.
 */
export function localDatabaseRefusal({ databaseUrl, nodeEnv }) {
  if (nodeEnv === 'production') {
    return 'NODE_ENV is production';
  }
  if (!databaseUrl) {
    return 'DATABASE_URL is not set';
  }
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    return 'DATABASE_URL does not parse as a URL';
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    return 'DATABASE_URL is not a postgres URL';
  }
  // A libpq `host=` query parameter overrides the URL's host.
  if (url.searchParams.has('host')) {
    return 'DATABASE_URL carries a host parameter';
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    return `the database host "${url.hostname}" is not this machine`;
  }
  return null;
}

function derive(id, purpose, length) {
  return createHash('sha256')
    .update(`myorganizer-qa-account/${id}/${purpose}`)
    .digest()
    .subarray(0, length)
    .toString('base64');
}

/**
 * The fixed key material behind one QA Account's vault, base64.
 *
 * Derived from the account id and never committed, so no key-shaped string
 * sits in the tree, and fixed, so minting twice gives the same vault: a
 * re-seed is a no-op and the seeder can always put the vault back.
 */
export function deriveQaKeyMaterial(id) {
  return {
    salt: derive(id, 'kdf-salt', 16),
    masterKey: derive(id, 'master-key', 32),
    recoveryKey: derive(id, 'recovery-key', 32),
    passphraseIv: derive(id, 'passphrase-wrap-iv', 12),
    recoveryIv: derive(id, 'recovery-wrap-iv', 12),
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

const META_FIELDS = [
  'version',
  'kdf_name',
  'kdf_salt',
  'kdf_params',
  'wrapped_mk_passphrase',
  'wrapped_mk_recovery',
];

/** Whether a stored vault row carries exactly the meta the seeder mints. */
export function vaultMetaMatches(stored, minted) {
  if (!stored) return false;
  return META_FIELDS.every(
    (field) =>
      JSON.stringify(canonical(stored[field])) ===
      JSON.stringify(canonical(minted[field])),
  );
}

/** Parses the CLI's arguments; `error` names the first one it does not know. */
export function parseQaAccountsArgs(argv) {
  const [command = 'print', ...rest] = argv;
  const parsed = { command, restore: false, account: null, error: null };
  if (command !== 'print' && command !== 'seed') {
    parsed.error = `unknown command "${command}" (expected "print" or "seed")`;
    return parsed;
  }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--restore' && command === 'seed') {
      parsed.restore = true;
    } else if (arg === '--account' && rest[index + 1]) {
      parsed.account = rest[index + 1];
      index += 1;
    } else {
      parsed.error = `unknown argument "${arg}"`;
      return parsed;
    }
  }
  return parsed;
}
