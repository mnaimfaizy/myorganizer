import {
  compareUsageLocationsByPriority,
  type AddressRecord,
  type AddressStatus,
  type MobileNumberRecord,
  type OrganisationType,
  type Priority,
  type UpdateMethod,
  type UsageLocationRecord,
} from '@myorganizer/vault-core/portable';

/**
 * What the Details screens read out of a decrypted Addresses or Mobile
 * Numbers Vault Blob.
 *
 * The payload is decrypted JSON written by some build of some client, so
 * every field but `id` is a claim — the same defensive reading
 * `taskModel.ts` and `subscriptionModel.ts` do for their own Vault Blob
 * Types. This module holds no React and imports no `react-native`, which is
 * what lets `libs/mobile/screens`' Jest project — a `node` environment with
 * no renderer — cover it.
 */
export type DecryptedAddress = Partial<AddressRecord> & { id: string };
export type DecryptedMobileNumber = Partial<MobileNumberRecord> & {
  id: string;
};
export type DecryptedUsageLocation = Partial<UsageLocationRecord> & {
  id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUsableId(entry: unknown): entry is { id: string } {
  return (
    isRecord(entry) &&
    typeof entry.id === 'string' &&
    (entry as { id: string }).id.length > 0
  );
}

/** Every Address in the payload, dropping any entry with no usable `id`. */
export function readVisibleAddresses(records: unknown): DecryptedAddress[] {
  if (!Array.isArray(records)) return [];
  return records.filter(hasUsableId) as DecryptedAddress[];
}

/** Every Mobile Number in the payload, dropping any entry with no usable `id`. */
export function readVisibleMobileNumbers(
  records: unknown,
): DecryptedMobileNumber[] {
  if (!Array.isArray(records)) return [];
  return records.filter(hasUsableId) as DecryptedMobileNumber[];
}

/** The one Address with `id`, or `null` when the payload holds none —
 * deleted on another device while this screen was open. */
export function findVisibleAddress(
  records: unknown,
  id: string,
): DecryptedAddress | null {
  return readVisibleAddresses(records).find((a) => a.id === id) ?? null;
}

/** The one Mobile Number with `id`, or `null`. See `findVisibleAddress`. */
export function findVisibleMobileNumber(
  records: unknown,
  id: string,
): DecryptedMobileNumber | null {
  return readVisibleMobileNumbers(records).find((m) => m.id === id) ?? null;
}

/** An Address's status, defaulting to `current` when the payload carries
 * none — the same "oldest data has no opinion" default `taskModel.ts` gives
 * a missing Task status. */
export function addressStatus(address: DecryptedAddress): AddressStatus {
  return address.status ?? 'current';
}

/** Current Addresses, then old ones — the split the Details list draws as
 * one section and one collapsed section. Order within each half is the
 * order the payload carried them in. */
export interface SplitAddresses {
  current: DecryptedAddress[];
  old: DecryptedAddress[];
}

export function splitAddressesByStatus(records: unknown): SplitAddresses {
  const current: DecryptedAddress[] = [];
  const old: DecryptedAddress[] = [];
  for (const address of readVisibleAddresses(records)) {
    (addressStatus(address) === 'old' ? old : current).push(address);
  }
  return { current, old };
}

/** The Usage Locations carried by an Address or Mobile Number, dropping any
 * entry with no usable `id` — the same defensive read as the top-level
 * records, applied one level in. */
export function readUsageLocations(
  contact: DecryptedAddress | DecryptedMobileNumber,
): DecryptedUsageLocation[] {
  const raw = contact.usageLocations;
  if (!Array.isArray(raw)) return [];
  return raw.filter(hasUsableId) as DecryptedUsageLocation[];
}

/** Whether a Usage Location has been notified. Defaults to not notified — a
 * record written before this field existed still needs telling. */
export function isNotified(location: DecryptedUsageLocation): boolean {
  return location.changed === true;
}

/** How many of `locations` still need notifying. */
export function countUnnotified(
  locations: readonly DecryptedUsageLocation[],
): number {
  return locations.filter((location) => !isNotified(location)).length;
}

/** The List row's own line — "3 to notify" — or `undefined` when every
 * Usage Location is notified, which is when the row prints nothing extra
 * and shows no amber dot. */
export function describeToNotify(
  locations: readonly DecryptedUsageLocation[],
): string | undefined {
  const count = countUnnotified(locations);
  return count > 0 ? `${count} to notify` : undefined;
}

/** "n of m notified" — the Usage Locations section's own progress meta. */
export interface NotifiedProgress {
  notified: number;
  total: number;
}

export function notifiedProgress(
  locations: readonly DecryptedUsageLocation[],
): NotifiedProgress {
  return {
    notified: locations.length - countUnnotified(locations),
    total: locations.length,
  };
}

/**
 * The Usage Locations detail order: every unnotified one first, by priority
 * (High, Medium, Normal, Low, the pinned table `usageLocationOrder.ts`
 * carries), then every notified one, in the same priority order.
 */
export function selectUsageLocationsForDetail(
  locations: readonly DecryptedUsageLocation[],
): DecryptedUsageLocation[] {
  const unnotified = locations
    .filter((location) => !isNotified(location))
    .sort(compareUsageLocationsByPriority);
  const notified = locations
    .filter((location) => isNotified(location))
    .sort(compareUsageLocationsByPriority);
  return [...unnotified, ...notified];
}

/** One field a Detail screen shows with its own tap-to-copy control. */
export interface CopyableField {
  id: string;
  label: string;
  value: string;
}

function field(
  id: string,
  label: string,
  value: string | undefined,
): CopyableField | null {
  return value != null && value.trim().length > 0 ? { id, label, value } : null;
}

function compact<T>(values: readonly (T | null | undefined)[]): T[] {
  return values.filter((value): value is T => value != null);
}

/**
 * An Address as one printable line — the structured fields joined in postal
 * order when any are present, or the legacy single-line `address` when they
 * are not. Never both: a record written before the structured fields
 * existed carries only the legacy line, and one written since carries the
 * structured fields as the ones a User actually edited.
 */
export function formatAddressLine(address: DecryptedAddress): string {
  const parts = compact([
    address.propertyNumber,
    address.street,
    address.suburb,
    address.state,
    address.zipCode,
    address.country,
  ]).map((part) => part.trim());
  if (parts.length > 0) return parts.join(', ');
  return address.address?.trim() ?? '';
}

/** The individually copyable fields of an Address, in the order they read
 * on a postal address, skipping any the record does not carry. */
export function addressFields(address: DecryptedAddress): CopyableField[] {
  return compact([
    field('propertyNumber', 'Property / unit number', address.propertyNumber),
    field('street', 'Street', address.street),
    field('suburb', 'Suburb', address.suburb),
    field('state', 'State', address.state),
    field('zipCode', 'Postcode', address.zipCode),
    field('country', 'Country', address.country),
    // Only shown when there is nothing structured to show instead, so a
    // fully-structured Address never prints its own summary line twice.
    address.propertyNumber == null &&
    address.street == null &&
    address.suburb == null &&
    address.state == null &&
    address.zipCode == null &&
    address.country == null
      ? field('address', 'Address', address.address)
      : null,
  ]);
}

/** A Mobile Number as one printable line — country code and number joined,
 * or the legacy single field when the structured ones are absent. */
export function formatMobileNumber(mobile: DecryptedMobileNumber): string {
  const parts = compact([mobile.countryCode, mobile.phoneNumber]).map((part) =>
    part.trim(),
  );
  if (parts.length > 0) return parts.join(' ');
  return mobile.mobileNumber?.trim() ?? '';
}

/** The individually copyable fields of a Mobile Number. See `addressFields`. */
export function mobileNumberFields(
  mobile: DecryptedMobileNumber,
): CopyableField[] {
  return compact([
    field('countryCode', 'Country code', mobile.countryCode),
    field('phoneNumber', 'Phone number', mobile.phoneNumber),
    mobile.countryCode == null && mobile.phoneNumber == null
      ? field('mobileNumber', 'Mobile number', mobile.mobileNumber)
      : null,
  ]);
}

/** Readable labels for `OrganisationType`, pinned to the enum (ADR 0053). */
export const ORGANISATION_TYPE_LABEL = {
  government: 'Government',
  private: 'Private',
  bank: 'Bank',
  insurance: 'Insurance',
  school: 'School',
  university: 'University',
  employer: 'Employer',
  utility: 'Utility',
  healthcare: 'Healthcare',
  telecom: 'Telecom',
  housing: 'Housing',
  email: 'Email',
  other: 'Other',
} as const satisfies Record<OrganisationType, string>;

/** Readable labels for `UpdateMethod`, pinned to the enum. */
export const UPDATE_METHOD_LABEL = {
  online: 'Online',
  inPerson: 'In person',
  phone: 'Phone',
  mail: 'Mail',
} as const satisfies Record<UpdateMethod, string>;

/** Readable labels for `Priority`, pinned to the enum. */
export const PRIORITY_LABEL = {
  high: 'High',
  medium: 'Medium',
  normal: 'Normal',
  low: 'Low',
} as const satisfies Record<Priority, string>;

/** A Usage Location row's own meta line: what it is, how it is reached, and
 * how urgent it is — the three facts the row carries besides its name and
 * its notified state. */
export function describeUsageLocationMeta(
  location: DecryptedUsageLocation,
): string {
  return compact([
    location.organisationType != null
      ? ORGANISATION_TYPE_LABEL[location.organisationType]
      : null,
    location.updateMethod != null
      ? UPDATE_METHOD_LABEL[location.updateMethod]
      : null,
    location.priority != null ? PRIORITY_LABEL[location.priority] : null,
  ]).join(' · ');
}

/**
 * The system maps app URL for an Address, so "Open in Maps" never renders
 * web content of its own — Apple Maps on iOS, Google Maps elsewhere, both
 * opened through the system browser handler rather than an in-app view.
 */
export function mapsUrlForAddress(
  address: DecryptedAddress,
  os: 'ios' | 'android',
): string {
  const query = encodeURIComponent(formatAddressLine(address));
  return os === 'ios'
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}
