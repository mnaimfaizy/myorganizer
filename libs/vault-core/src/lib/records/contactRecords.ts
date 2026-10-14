import type { KnownKeys } from './unknownFields';

export const AddressStatusEnum = {
  Current: 'current',
  Old: 'old',
} as const;

export type AddressStatus =
  (typeof AddressStatusEnum)[keyof typeof AddressStatusEnum];

export const OrganisationTypeEnum = {
  Government: 'government',
  Private: 'private',
  Bank: 'bank',
  Insurance: 'insurance',
  School: 'school',
  University: 'university',
  Employer: 'employer',
  Utility: 'utility',
  Healthcare: 'healthcare',
  Telecom: 'telecom',
  Housing: 'housing',
  Email: 'email',
  Other: 'other',
} as const;

export type OrganisationType =
  (typeof OrganisationTypeEnum)[keyof typeof OrganisationTypeEnum];

export const UpdateMethodEnum = {
  Online: 'online',
  InPerson: 'inPerson',
  Phone: 'phone',
  Mail: 'mail',
} as const;

export type UpdateMethod =
  (typeof UpdateMethodEnum)[keyof typeof UpdateMethodEnum];

export const PriorityEnum = {
  Low: 'low',
  Normal: 'normal',
  Medium: 'medium',
  High: 'high',
} as const;

export type Priority = (typeof PriorityEnum)[keyof typeof PriorityEnum];

export type IsoDateTimeString = string;

export type UsageLocationRecord = {
  id: string;
  organisationName: string;
  organisationType: OrganisationType;
  updateMethod: UpdateMethod;
  changed: boolean;
  link?: string;
  priority: Priority;
  createdAt: IsoDateTimeString;
  changedAt?: IsoDateTimeString;
};

export type AddressRecord = {
  id: string;
  label: string;
  // Legacy single-line address (for backward compatibility)
  address?: string;
  // Structured address fields
  propertyNumber?: string;
  street?: string;
  suburb?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  status: AddressStatus;
  usageLocations: UsageLocationRecord[];
  createdAt: IsoDateTimeString;
  /**
   * When this Address last changed — what merging resolves a collision by.
   *
   * Optional, and absent on every Address written before merging existed. A
   * normalizer carries it through but never invents one: a fabricated instant
   * claims an edit that never happened, and beats the copy that was really
   * edited.
   */
  updatedAt?: IsoDateTimeString;
};

export type MobileNumberRecord = {
  id: string;
  label: string;
  // Legacy single field (for backward compatibility)
  mobileNumber?: string;
  // Structured phone fields
  countryCode?: string;
  phoneNumber?: string;
  usageLocations: UsageLocationRecord[];
  createdAt: IsoDateTimeString;
  /** When this Mobile Number last changed. See `AddressRecord.updatedAt`. */
  updatedAt?: IsoDateTimeString;
};

/**
 * Every Usage Location key a reader understands, pinned to the type: a field added to
 * `UsageLocationRecord` must be added here too. Keys not in this table are unknown fields,
 * which every writer carries through untouched (ADR 0114 decision 3).
 */
export const USAGE_LOCATION_KEYS = {
  id: true,
  organisationName: true,
  organisationType: true,
  updateMethod: true,
  changed: true,
  link: true,
  priority: true,
  createdAt: true,
  changedAt: true,
} as const satisfies KnownKeys<UsageLocationRecord>;

/**
 * Every Address key a reader understands, pinned to the type: a field added to
 * `AddressRecord` must be added here too. Keys not in this table are unknown fields,
 * which every writer carries through untouched (ADR 0114 decision 3).
 */
export const ADDRESS_KEYS = {
  id: true,
  label: true,
  address: true,
  propertyNumber: true,
  street: true,
  suburb: true,
  state: true,
  zipCode: true,
  country: true,
  status: true,
  usageLocations: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies KnownKeys<AddressRecord>;

/**
 * Every Mobile Number key a reader understands, pinned to the type: a field added to
 * `MobileNumberRecord` must be added here too. Keys not in this table are unknown fields,
 * which every writer carries through untouched (ADR 0114 decision 3).
 */
export const MOBILE_NUMBER_KEYS = {
  id: true,
  label: true,
  mobileNumber: true,
  countryCode: true,
  phoneNumber: true,
  usageLocations: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies KnownKeys<MobileNumberRecord>;
