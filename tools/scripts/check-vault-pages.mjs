#!/usr/bin/env node
// Asserts that the vault diagrams still describe the vault the code implements.
//
//   node tools/scripts/check-vault-pages.mjs
//
// Both pages embed a manifest of the constants they assert. This diffs each manifest against
// the constants in source, so a parameter change breaks the build instead of leaving a
// confidently wrong security reference in docs/.
//
// The pages' own `assertableFrom` blocks are conservative — they list only what a consumer
// could import from a published package. This check reads the repo, so it can be stricter.
//
// Exit 0 = in sync. Exit 1 = drift (rebuild or fix the page). Exit 2 = the check could not run.
import { readFileSync, existsSync } from 'node:fs';

const PAGES = [
  ['docs/vault/trust-boundary.html', 'vault-map-manifest'],
  ['docs/vault/lifecycle.html', 'vault-lifecycle-manifest'],
];

const fail = (msg) => {
  console.error(`vault-pages: ${msg}`);
  process.exit(2);
};

// Where each constant lives. Values are read from source rather than imported, because these
// are TypeScript modules and several of the caps are deliberately module-private.
const SOURCES = {
  VAULT_ENVELOPE_PARSE_MAX_BYTES:
    'libs/vault-core/src/lib/vaultExportEnvelope.ts',
  CURRENT_VAULT_EXPORT_SCHEMA_VERSION:
    'libs/vault-core/src/lib/vaultExportEnvelope.ts',
  VAULT_EXPORT_BLOB_TYPES: 'libs/vault-core/src/lib/vaultExportEnvelope.ts',
  VAULT_IMPORT_ERROR_CODES: 'libs/vault-core/src/lib/vaultImportError.ts',
  VAULT_LEGACY_BUNDLE_MAX_BYTES:
    'libs/web-vault/src/lib/vault/vaultExportImport.ts',
  PBKDF2_ITERATIONS: 'libs/web-vault/src/lib/vault/vault.ts',
  VAULT_STORAGE_KEY: 'libs/web-vault/src/lib/vault/vault.ts',
  DEFAULT_CAPACITY: 'libs/web-vault/src/lib/vault/replayTracker.ts',
  SALT_LENGTH: 'libs/mobile/feat/vault/src/constants.ts',
  IV_LENGTH: 'libs/mobile/feat/vault/src/constants.ts',
  MASTER_KEY_LENGTH: 'libs/mobile/feat/vault/src/constants.ts',
  PBKDF2_HASH: 'libs/mobile/feat/vault/src/constants.ts',
  VAULT_EXPORT_PAYLOAD_MAX_BYTES: 'apps/backend/src/services/VaultService.ts',
  VAULT_META_MAX_BYTES: 'apps/backend/src/services/VaultService.ts',
  VAULT_BLOB_MAX_BYTES: 'apps/backend/src/services/VaultService.ts',
  VAULT_BACKUP_MAX_SIZE_BYTES:
    'apps/backend/src/services/vaultBackupConstants.ts',
};

const fileCache = new Map();
const read = (path) => {
  if (!fileCache.has(path)) {
    if (!existsSync(path)) fail(`${path} not found`);
    fileCache.set(path, readFileSync(path, 'utf8'));
  }
  return fileCache.get(path);
};

// Numeric constants are written as small arithmetic expressions (`10 * 1024 * 1024`, `310_000`).
const evalNumeric = (expr, name) => {
  const cleaned = expr.replace(/_/g, '').trim();
  if (!/^[\d\s*+]+$/.test(cleaned)) fail(`${name} is not a numeric expression`);
  return Function(`"use strict";return (${cleaned})`)();
};

function constant(name) {
  const source = read(SOURCES[name]);

  const array = source.match(
    new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`),
  );
  if (array) return [...array[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

  const str = source.match(new RegExp(`const ${name}\\s*=\\s*'([^']*)'`));
  if (str) return str[1];

  const num = source.match(new RegExp(`const ${name}\\s*=\\s*([^;]+);`));
  if (num) return evalNumeric(num[1].replace(/\s+as const$/, ''), name);

  fail(`could not read ${name} from ${SOURCES[name]}`);
}

// Manifest path -> the source constant it must equal. The two pages key their caps slightly
// differently, so any path a given manifest does not declare is skipped rather than failed.
const EXPECTATIONS = [
  ['kdf.iterations', 'PBKDF2_ITERATIONS'],
  ['kdf.hash', 'PBKDF2_HASH'],
  ['kdf.saltBytes', 'SALT_LENGTH'],
  ['cipher.keyBytes', 'MASTER_KEY_LENGTH'],
  ['cipher.vaultIvBytes', 'IV_LENGTH'],
  ['envelope.schemaVersion', 'CURRENT_VAULT_EXPORT_SCHEMA_VERSION'],
  ['envelope.envelopeParseBytes', 'VAULT_ENVELOPE_PARSE_MAX_BYTES'],
  ['blobTypes', 'VAULT_EXPORT_BLOB_TYPES'],
  ['errorCodes', 'VAULT_IMPORT_ERROR_CODES'],
  ['storageKey', 'VAULT_STORAGE_KEY'],
  ['import.replayHistoryLength', 'DEFAULT_CAPACITY'],
  ['limits.envelopeParseBytes', 'VAULT_ENVELOPE_PARSE_MAX_BYTES'],
  ['limits.legacyBundleParseBytes', 'VAULT_LEGACY_BUNDLE_MAX_BYTES'],
  ['limits.backendExportBytes', 'VAULT_EXPORT_PAYLOAD_MAX_BYTES'],
  ['limits.backendImportBytes', 'VAULT_EXPORT_PAYLOAD_MAX_BYTES'],
  ['limits.backendAuditSizeBytesCap', 'VAULT_BACKUP_MAX_SIZE_BYTES'],
  ['limits.backendVaultMetaBytes', 'VAULT_META_MAX_BYTES'],
  ['limits.backendBlobBytes', 'VAULT_BLOB_MAX_BYTES'],
  ['backendLimits.backendExportBytes', 'VAULT_EXPORT_PAYLOAD_MAX_BYTES'],
  ['backendLimits.backendImportBytes', 'VAULT_EXPORT_PAYLOAD_MAX_BYTES'],
  ['backendLimits.backendVaultMetaBytes', 'VAULT_META_MAX_BYTES'],
  ['backendLimits.backendBlobBytes', 'VAULT_BLOB_MAX_BYTES'],
];

const dig = (obj, path) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const findings = [];
let asserted = 0;

for (const [page, manifestId] of PAGES) {
  if (!existsSync(page)) fail(`${page} not found — build it first`);

  const html = readFileSync(page, 'utf8');
  const block = html.match(
    new RegExp(
      `<script type="application/json" id="${manifestId}">([\\s\\S]*?)</script>`,
    ),
  );
  if (!block)
    fail(`no #${manifestId} block in ${page} — rebuild it from the export`);

  let manifest;
  try {
    manifest = JSON.parse(block[1]);
  } catch (err) {
    fail(`#${manifestId} is not valid JSON: ${err.message}`);
  }

  let declared = 0;
  for (const [path, name] of EXPECTATIONS) {
    const claimed = dig(manifest, path);
    if (claimed === undefined) continue;
    declared += 1;

    const expected = constant(name);
    // Blob types and error codes are sets, not sequences. A page is free to order them by the
    // sequence a reader meets them — which is more useful than mirroring declaration order —
    // so compare membership. Only a missing or invented member is drift.
    const same = Array.isArray(expected)
      ? Array.isArray(claimed) &&
        expected.length === claimed.length &&
        [...expected].sort().every((v, i) => v === [...claimed].sort()[i])
      : expected === claimed;

    if (same) {
      asserted += 1;
    } else {
      findings.push(
        `${page} → ${path}: page says ${JSON.stringify(claimed)}, ` +
          `${name} is ${JSON.stringify(expected)}`,
      );
    }
  }

  if (declared === 0) {
    findings.push(
      `${page} → #${manifestId} declares nothing this check knows how to verify`,
    );
  }
}

if (findings.length > 0) {
  console.error(
    `vault-pages: ${findings.length} finding(s) — the vault diagrams are out of date\n`,
  );
  for (const f of findings) console.error(`  - ${f}`);
  console.error(
    `\nRebuild from the design export, or correct the page to match the source constants.`,
  );
  process.exit(1);
}

console.log(
  `vault-pages: OK — ${asserted} assertions across ${PAGES.length} pages match the source constants`,
);
