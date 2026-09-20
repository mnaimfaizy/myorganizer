/**
 * The decisions behind `yarn escape-copy-reader:check`, separated from its IO
 * so they can be exercised against fixtures.
 *
 * `tools/scripts/check-escape-copy-reader.mjs` is the half that builds the
 * reader, runs the real exporter and evaluates the built page; this half is
 * every judgment that file makes about what it got back. Splitting them is
 * what lets the contract suite prove the checker fails on the drift its header
 * claims to catch (ADR 0085) without building a 500 KB page per assertion.
 */

/**
 * Capabilities the reader must not have, and why each one would matter.
 *
 * Matched against the built page's text, which is unminified on purpose — see
 * the build script. A match is a finding even if it is unreachable at run
 * time: this is a file Users are told to verify by checksum and then trust
 * with a vault passphrase, and "it is in there but never called" is not a
 * claim a checksum can carry.
 */
export const FORBIDDEN_CAPABILITIES = [
  ['fetch(', 'reaches the network'],
  ['XMLHttpRequest', 'reaches the network'],
  ['WebSocket', 'reaches the network'],
  ['sendBeacon', 'reaches the network'],
  ['EventSource', 'reaches the network'],
  ['import(', 'can load code at run time'],
  ['importScripts', 'can load code at run time'],
  ['localStorage', 'writes browser storage'],
  ['sessionStorage', 'writes browser storage'],
  ['indexedDB', 'writes browser storage'],
  ['document.cookie', 'writes browser storage'],
];

/** An external resource reference, which would make the file non-self-contained. */
const EXTERNAL_REFERENCE = /(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//giu;

/**
 * Everything wrong with the built page as a *file*: a capability it must not
 * have, or a resource it would have to fetch to render.
 */
export function capabilityFindings(html) {
  const findings = [];

  for (const [needle, why] of FORBIDDEN_CAPABILITIES) {
    if (html.includes(needle)) {
      findings.push(
        `the built reader contains \`${needle}\`, which ${why}. ADR 0064's reader ` +
          `needs nothing of ours and holds nothing of the User's.`,
      );
    }
  }

  for (const match of html.matchAll(EXTERNAL_REFERENCE)) {
    findings.push(
      `the built reader references an external resource (\`${match[0].trim()}\`). ` +
        `It must open from file:// with the network cable out.`,
    );
  }

  return findings;
}

/**
 * Whether the plaintext the reader yielded is the plaintext the exporter put
 * in — for every Vault Blob Type, not just the ones both happen to agree on.
 *
 * A missing type is reported as its own finding rather than folded into a
 * mismatch, because the two mean different things: a type the reader skipped
 * is data the User cannot get back at all, and that is precisely the omission
 * ADR 0053 exists to prevent and that dropped Tasks from hardened export in
 * #537.
 */
export function sectionFindings({ label, opened, expected }) {
  const present = opened.sections.filter((section) => section.present);
  const expectedTypes = Object.keys(expected).sort();
  const openedTypes = present.map((section) => section.type).sort();

  if (openedTypes.join(',') !== expectedTypes.join(',')) {
    return [
      `${label}: the exporter put [${expectedTypes.join(', ')}] in the envelope, ` +
        `but the reader yielded [${openedTypes.join(', ')}]. A Vault Blob Type the ` +
        `reader skips is data the User cannot get back.`,
    ];
  }

  const findings = [];
  for (const section of present) {
    const want = JSON.stringify(expected[section.type]);
    const got = JSON.stringify(section.plaintext);
    if (want !== got) {
      findings.push(
        `${label}: the ${section.type} section did not round-trip. ` +
          `Expected ${want}, got ${got}.`,
      );
    }
  }
  return findings;
}

/**
 * Whether the reader was built for the schema version the exporter is
 * producing today.
 *
 * This is ADR 0064 decision 2 in one comparison: a reader pinned to a version
 * the exporter has moved past fails at the only moment anyone runs it, and
 * fails silently until then.
 */
export function schemaVersionFindings({ exporterVersion, readerVersion }) {
  if (exporterVersion === readerVersion) return [];
  return [
    `the exporter produced schema version ${exporterVersion} and the reader ` +
      `was built for ${readerVersion}. This is exactly the drift ADR 0064 ` +
      `decision 2 exists to catch.`,
  ];
}

/**
 * Whether the published checksum is the checksum of the published file.
 *
 * The distribution answer is "a file you hold, with a number you check". A
 * number that does not match the file it sits beside trains Users to skip the
 * check, which costs more than publishing nothing would.
 */
export function checksumFindings({ checksumFileText, digest, filename }) {
  const actual = checksumFileText.trim();
  const expected = `${digest}  ${filename}`;
  if (actual === expected) return [];
  return [
    `the checksum file says \`${actual}\` but the built reader hashes to ` +
      `\`${expected}\`. The number Users are told to verify must be the number ` +
      `this build produces.`,
  ];
}

/**
 * Whether every place that *names* the published artifacts agrees with what
 * the build actually publishes.
 *
 * Three files carry those two filenames and nothing reconciled them: the build
 * script, the vault page's constants — which is what the in-product prompt
 * tells a User to download — and the reader's own page, which tells a User
 * which checksum file to compare against. Renaming the artifact in one place
 * leaves the other two pointing at a file that is not there, and a User
 * following an instruction to check a checksum that does not exist is worse
 * off than one who was never told to check
 * ([ADR 0051](../../../docs/adr/0051-a-pinned-value-does-not-notice-that-its-meaning-moved.md)).
 *
 * Asserted rather than shared, because a `scope:web` library may not import a
 * repo script and a self-contained page may not import anything at all. The
 * names have to be written three times; they do not have to drift.
 *
 * One direction, and it covers both: every site must contain the name the
 * build publishes. A rename in the build leaves the other sites failing, and a
 * rename in a site leaves that site failing. There is deliberately no check
 * for a *stale* name — "does this file still mention the old one" needs the
 * old one to be written down somewhere, which is another pinned value with
 * exactly this problem.
 */
export function publishedNameFindings({ sources }) {
  const findings = [];

  for (const { label, text, expect } of sources) {
    for (const name of expect) {
      if (!text.includes(name)) {
        findings.push(
          `${label} does not name \`${name}\`, which is what the build ` +
            `publishes. Every place that tells a User which file to fetch or ` +
            `which checksum to compare has to name the one that exists.`,
        );
      }
    }
  }

  return findings;
}
