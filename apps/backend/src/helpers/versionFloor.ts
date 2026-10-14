import type { VersionFloorRefusal } from '../types';

/**
 * Version Floor (ADR 0114 decision 1; CONTEXT.md, Version Floor). Pure logic:
 * no Express imports. The middleware in `middleware/versionFloor.ts` wires it
 * to requests.
 */

export type MobilePlatform = 'android' | 'ios';

/** The configured floor, read once from MOBILE_VERSION_FLOOR. */
export type VersionFloorConfig =
  | { kind: 'off' }
  | { kind: 'floor'; version: string }
  | { kind: 'invalid'; raw: string };

/** What the X-Client header of a request says about its client. */
export type ClientHeader =
  | { kind: 'absent' }
  | { kind: 'mobile'; version: string; platform: MobilePlatform }
  | { kind: 'malformed'; platform: MobilePlatform | null };

export type VersionFloorDecision =
  | { kind: 'pass' }
  | { kind: 'refuse'; body: VersionFloorRefusal };

// Strict X.Y.Z: non-negative integers, no leading zeros, no prerelease or
// build metadata. Mobile Release versions are shared by both platforms.
const MOBILE_RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// `mobile/<X.Y.Z> (<android|ios>)`, for example `mobile/1.0.0 (ios)`.
const CLIENT_HEADER = /^mobile\/(\S+) \((android|ios)\)$/;

const TRAILING_PLATFORM = /\((android|ios)\)$/;

const PASS: VersionFloorDecision = { kind: 'pass' };

function parseStrictVersion(raw: string): [number, number, number] | undefined {
  const match = MOBILE_RELEASE_VERSION.exec(raw);
  if (!match) return undefined;

  const parts: [number, number, number] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  // A component beyond the safe integer range cannot be compared exactly,
  // so it is treated as not a version at all.
  if (!parts.every((part) => Number.isSafeInteger(part))) return undefined;
  return parts;
}

/** Unset or blank is off. A value that is not X.Y.Z is invalid, never off. */
export function parseVersionFloor(raw: string | undefined): VersionFloorConfig {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { kind: 'off' };
  if (!parseStrictVersion(trimmed)) return { kind: 'invalid', raw: trimmed };
  return { kind: 'floor', version: trimmed };
}

/**
 * An absent header is the web app. Any other value that is not the exact
 * `mobile/<X.Y.Z> (<platform>)` grammar is malformed; the platform is still
 * reported when its trailing `(android|ios)` is recognisable.
 */
export function parseClientHeader(raw: string | undefined): ClientHeader {
  if (raw === undefined) return { kind: 'absent' };

  const match = CLIENT_HEADER.exec(raw);
  if (match) {
    const [, version, platform] = match;
    if (parseStrictVersion(version)) {
      return {
        kind: 'mobile',
        version,
        platform: platform as MobilePlatform,
      };
    }
    return { kind: 'malformed', platform: platform as MobilePlatform };
  }

  const trailing = TRAILING_PLATFORM.exec(raw);
  return {
    kind: 'malformed',
    platform: trailing ? (trailing[1] as MobilePlatform) : null,
  };
}

/**
 * Semver numeric compare of two Mobile Release versions (X.Y.Z). Negative when
 * `a` is lower, positive when higher, zero when equal. Inputs are expected to
 * be validated versions; anything else is a programming error.
 */
export function compareMobileRelease(a: string, b: string): number {
  const left = parseStrictVersion(a);
  const right = parseStrictVersion(b);
  if (!left || !right) {
    throw new TypeError(
      `compareMobileRelease expects X.Y.Z versions, got "${a}" and "${b}"`,
    );
  }

  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function refuse(
  versionFloor: string,
  platform: MobilePlatform | null,
): VersionFloorDecision {
  return {
    kind: 'refuse',
    body: {
      code: 'below_version_floor',
      message: 'Update the MyOrganizer Mobile App to continue.',
      versionFloor,
      platform,
    },
  };
}

/**
 * Off passes everything. The web app (no header) always passes. A malformed
 * header is refused. An invalid floor refuses every Mobile App request and
 * never blocks the web app. Otherwise the Mobile Release must be at or above
 * the floor.
 */
export function decideVersionFloor(
  floor: VersionFloorConfig,
  client: ClientHeader,
): VersionFloorDecision {
  if (floor.kind === 'off') return PASS;
  if (client.kind === 'absent') return PASS;

  if (floor.kind === 'invalid') return refuse(floor.raw, client.platform);
  if (client.kind === 'malformed')
    return refuse(floor.version, client.platform);

  if (compareMobileRelease(client.version, floor.version) < 0) {
    return refuse(floor.version, client.platform);
  }
  return PASS;
}
