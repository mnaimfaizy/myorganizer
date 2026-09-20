// Contracts for the Escape Copy reader gate (ADR 0085): proof that it fails on
// each drift its header claims to catch, rather than merely saying so.
//
// The judgments are exercised directly against fixtures, which is why they
// live in tools/scripts/lib/escape-copy-reader-gate.mjs at all: the checker
// itself builds a 500 KB page and runs PBKDF2 at 310,000 iterations four
// times, so a suite that drove it end-to-end per assertion would cost minutes
// to assert seconds of logic. The one end-to-end case below covers the wiring
// the fixtures cannot — that the built artifact really is what gets run.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  capabilityFindings,
  checksumFindings,
  publishedNameFindings,
  schemaVersionFindings,
  sectionFindings,
} from './lib/escape-copy-reader-gate.mjs';
import {
  READER_FILENAME,
  composeReaderHtml,
  sha256,
} from './build-escape-copy-reader.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const CHECKER = join(HERE, 'check-escape-copy-reader.mjs');

const CLEAN_PAGE = '<html><body><script>const x = 1;</script></body></html>';

test('a clean page produces no capability findings', () => {
  assert.deepEqual(capabilityFindings(CLEAN_PAGE), []);
});

test('a reader that can reach the network is a finding', () => {
  for (const reach of [
    'fetch("https://example.test")',
    'new XMLHttpRequest()',
    'new WebSocket("wss://x")',
    'navigator.sendBeacon(u, d)',
    'new EventSource(u)',
  ]) {
    const findings = capabilityFindings(`<script>${reach}</script>`);
    assert.equal(findings.length, 1, `expected a finding for ${reach}`);
    assert.match(findings[0], /reaches the network/u);
  }
});

test('a reader that can load code at run time is a finding', () => {
  assert.match(
    capabilityFindings('<script>await import("./x.js")</script>')[0],
    /can load code at run time/u,
  );
});

test('a reader that touches browser storage is a finding', () => {
  for (const store of [
    'localStorage.setItem(k, v)',
    'sessionStorage.setItem(k, v)',
    'indexedDB.open("v")',
    'document.cookie = c',
  ]) {
    const findings = capabilityFindings(`<script>${store}</script>`);
    assert.equal(findings.length, 1, `expected a finding for ${store}`);
    assert.match(findings[0], /writes browser storage/u);
  }
});

test('an external stylesheet, script or font makes the page a finding', () => {
  for (const reference of [
    '<script src="https://cdn.test/z.js"></script>',
    '<link href="//fonts.test/x.css" rel="stylesheet" />',
    "<script src='http://cdn.test/z.js'></script>",
  ]) {
    const findings = capabilityFindings(reference);
    assert.equal(findings.length, 1, `expected a finding for ${reference}`);
    assert.match(findings[0], /external resource/u);
  }
});

test('a reader built for a different schema version than the exporter produces is a finding', () => {
  assert.deepEqual(
    schemaVersionFindings({ exporterVersion: 1, readerVersion: 1 }),
    [],
  );
  const drift = schemaVersionFindings({ exporterVersion: 2, readerVersion: 1 });
  assert.equal(drift.length, 1);
  assert.match(drift[0], /ADR 0064\s+decision 2/u);
});

test('a Vault Blob Type the reader drops is a finding, named as a drop', () => {
  const findings = sectionFindings({
    label: 'opened with the passphrase',
    opened: {
      sections: [
        { type: 'addresses', present: true, plaintext: { records: [] } },
        // `tasks` was exported and is absent here: the #537 shape.
        { type: 'tasks', present: false, plaintext: null },
      ],
    },
    expected: { addresses: { records: [] }, tasks: { records: [] } },
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0], /A Vault Blob Type the reader skips/u);
});

test('a section that decrypts to different plaintext is a finding', () => {
  const findings = sectionFindings({
    label: 'opened with the Recovery Key',
    opened: {
      sections: [{ type: 'tasks', present: true, plaintext: { records: [1] } }],
    },
    expected: { tasks: { records: [2] } },
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0], /did not round-trip/u);
});

test('a section that round-trips exactly is not a finding', () => {
  assert.deepEqual(
    sectionFindings({
      label: 'opened with the passphrase',
      opened: {
        sections: [
          { type: 'tasks', present: true, plaintext: { records: [1] } },
          { type: 'groceries', present: false, plaintext: null },
        ],
      },
      expected: { tasks: { records: [1] } },
    }),
    [],
  );
});

test('a published checksum that does not match the built file is a finding', () => {
  const digest = sha256('the page');
  assert.deepEqual(
    checksumFindings({
      checksumFileText: `${digest}  ${READER_FILENAME}\n`,
      digest,
      filename: READER_FILENAME,
    }),
    [],
  );

  const stale = checksumFindings({
    checksumFileText: `${sha256('an older page')}  ${READER_FILENAME}\n`,
    digest,
    filename: READER_FILENAME,
  });
  assert.equal(stale.length, 1);
  assert.match(stale[0], /must be the number/u);
});

test('a site naming a file the build does not publish is a finding', () => {
  assert.deepEqual(
    publishedNameFindings({
      sources: [
        {
          label: 'the constants',
          text: `export const A = '${READER_FILENAME}';
export const B = 'SHA256SUMS.txt';`,
          expect: [READER_FILENAME, 'SHA256SUMS.txt'],
        },
      ],
    }),
    [],
  );

  // The build renamed the artifact and the in-product prompt did not follow:
  // a User told to download a file that is not on the release.
  const drift = publishedNameFindings({
    sources: [
      {
        label: 'the constants',
        text: "export const A = 'myorganizer-reader-OLD.html';",
        expect: [READER_FILENAME, 'SHA256SUMS.txt'],
      },
    ],
  });
  assert.equal(drift.length, 2);
  assert.match(drift[0], /does not name/u);
});

test('a page shell that lost a placeholder fails the build rather than shipping an empty reader', () => {
  assert.throws(
    () =>
      composeReaderHtml({
        shell: '<html><style></style><script></script></html>',
        tokensCss: ':root{}',
        bundleJs: 'void 0;',
        stamp: '// stamp',
      }),
    /placeholder/u,
  );
});

test('the checker passes on this tree, running the built artifact end to end', () => {
  const result = spawnSync(process.execPath, [CHECKER], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    `expected exit 0, got ${result.status}\n${result.stdout}\n${result.stderr}`,
  );
  assert.match(
    result.stdout,
    /opens with both the passphrase and the Recovery Key/u,
  );
});
