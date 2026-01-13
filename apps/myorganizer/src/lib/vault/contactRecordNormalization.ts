import {
  AddressRecord,
  AddressStatusEnum,
  MobileNumberRecord,
  OrganisationTypeEnum,
  PriorityEnum,
  UpdateMethodEnum,
  UsageLocationRecord,
  type OrganisationType,
  type Priority,
  type UpdateMethod,
} from '@myorganizer/core';

type NormalizeResult<T> = {
  value: T;
  changed: boolean;
};

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function parseOrganisationType(value: unknown): OrganisationType {
  const input = toTrimmedString(value);
  if (!input) return OrganisationTypeEnum.Other;

  const lower = input.toLowerCase();

  for (const option of Object.values(OrganisationTypeEnum)) {
    if (option.toLowerCase() === lower) return option;
  }

  for (const key of Object.keys(OrganisationTypeEnum)) {
    if (key.toLowerCase() === lower) {
      return OrganisationTypeEnum[key as keyof typeof OrganisationTypeEnum];
    }
  }

  return OrganisationTypeEnum.Other;
}

function parseUpdateMethod(value: unknown): UpdateMethod {
  const input = toTrimmedString(value);
  if (!input) return UpdateMethodEnum.Online;

  const lower = input.toLowerCase();

  for (const option of Object.values(UpdateMethodEnum)) {
    if (option.toLowerCase() === lower) return option;
  }

  for (const key of Object.keys(UpdateMethodEnum)) {
    if (key.toLowerCase() === lower) {
      return UpdateMethodEnum[key as keyof typeof UpdateMethodEnum];
    }
  }

  return UpdateMethodEnum.Online;
}

function parsePriority(value: unknown): Priority {
  const input = toTrimmedString(value);
  if (!input) return PriorityEnum.Normal;

  const lower = input.toLowerCase();

  for (const option of Object.values(PriorityEnum)) {
    if (option.toLowerCase() === lower) return option;
  }

  for (const key of Object.keys(PriorityEnum)) {
    if (key.toLowerCase() === lower) {
      return PriorityEnum[key as keyof typeof PriorityEnum];
    }
  }

  return PriorityEnum.Normal;
}

function normalizeUsageLocation(
  value: unknown
): NormalizeResult<UsageLocationRecord | null> {
  if (!value || typeof value !== 'object')
    return { value: null, changed: false };

  const raw = value as any;

  const organisationName = toTrimmedString(raw.organisationName);
  if (!organisationName) return { value: null, changed: true };

  const next: UsageLocationRecord = {
    id: toTrimmedString(raw.id) ?? randomId(),
    organisationName,
    organisationType: parseOrganisationType(raw.organisationType),
    updateMethod: parseUpdateMethod(raw.updateMethod ?? raw.changeType),
    changed: Boolean(raw.changed),
    link: toTrimmedString(raw.link) ?? undefined,
    priority: parsePriority(raw.priority),
    createdAt: toTrimmedString(raw.createdAt) ?? isoNow(),
    changedAt: toTrimmedString(raw.changedAt) ?? undefined,
  };

  if (next.changed && !next.changedAt) {
    next.changedAt = isoNow();
  }

  const changed =
    next.id !== raw.id ||
    next.organisationName !== raw.organisationName ||
    next.organisationType !== raw.organisationType ||
    next.updateMethod !== (raw.updateMethod ?? raw.changeType) ||
    next.changed !== Boolean(raw.changed) ||
    next.link !== raw.link ||
    next.priority !== raw.priority ||
    next.createdAt !== raw.createdAt ||
    next.changedAt !== raw.changedAt;

  return { value: next, changed };
}

export function normalizeAddresses(
  value: unknown
): NormalizeResult<AddressRecord[]> {
  if (!Array.isArray(value)) return { value: [], changed: value != null };

  let changed = false;
  const normalized: AddressRecord[] = [];

  for (const item of value) {
    if (typeof item === 'string') {
      changed = true;
      normalized.push({
        id: randomId(),
        label: 'Address',
        address: item.trim(),
        status: AddressStatusEnum.Current,
        usageLocations: [],
        createdAt: isoNow(),
      });
      continue;
    }

    if (!item || typeof item !== 'object') {
      changed = true;
      continue;
    }

    const raw = item as any;

    const rawUsage = Array.isArray(raw.usageLocations)
      ? raw.usageLocations
      : [];
    const nextUsage: UsageLocationRecord[] = [];
    for (const u of rawUsage) {
      const uNorm = normalizeUsageLocation(u);
      if (uNorm.value) nextUsage.push(uNorm.value);
      if (uNorm.changed) changed = true;
    }

    const next: AddressRecord = {
      id: toTrimmedString(raw.id) ?? randomId(),
      label: toTrimmedString(raw.label) ?? 'Address',
      address: toTrimmedString(raw.address) ?? '',
      status:
        raw.status === AddressStatusEnum.Old
          ? AddressStatusEnum.Old
          : AddressStatusEnum.Current,
      usageLocations: nextUsage,
      createdAt: toTrimmedString(raw.createdAt) ?? isoNow(),
    };

    if (next.id !== raw.id) changed = true;
    if (next.label !== raw.label) changed = true;
    if (next.address !== raw.address) changed = true;
    if (next.status !== raw.status) changed = true;
    if (!Array.isArray(raw.usageLocations)) changed = true;
    if (next.createdAt !== raw.createdAt) changed = true;

    normalized.push(next);
  }

  return { value: normalized, changed };
}

export function normalizeMobileNumbers(
  value: unknown
): NormalizeResult<MobileNumberRecord[]> {
  if (!Array.isArray(value)) return { value: [], changed: value != null };

  let changed = false;
  const normalized: MobileNumberRecord[] = [];

  for (const item of value) {
    if (typeof item === 'string') {
      changed = true;
      normalized.push({
        id: randomId(),
        label: 'Mobile',
        mobileNumber: item.trim(),
        usageLocations: [],
        createdAt: isoNow(),
      });
      continue;
    }

    if (!item || typeof item !== 'object') {
      changed = true;
      continue;
    }

    const raw = item as any;

    const rawUsage = Array.isArray(raw.usageLocations)
      ? raw.usageLocations
      : [];
    const nextUsage: UsageLocationRecord[] = [];
    for (const u of rawUsage) {
      const uNorm = normalizeUsageLocation(u);
      if (uNorm.value) nextUsage.push(uNorm.value);
      if (uNorm.changed) changed = true;
    }

    const next: MobileNumberRecord = {
      id: toTrimmedString(raw.id) ?? randomId(),
      label: toTrimmedString(raw.label) ?? 'Mobile',
      mobileNumber: toTrimmedString(raw.mobileNumber) ?? '',
      usageLocations: nextUsage,
      createdAt: toTrimmedString(raw.createdAt) ?? isoNow(),
    };

    if (next.id !== raw.id) changed = true;
    if (next.label !== raw.label) changed = true;
    if (next.mobileNumber !== raw.mobileNumber) changed = true;
    if (!Array.isArray(raw.usageLocations)) changed = true;
    if (next.createdAt !== raw.createdAt) changed = true;

    normalized.push(next);
  }

  return { value: normalized, changed };
}
