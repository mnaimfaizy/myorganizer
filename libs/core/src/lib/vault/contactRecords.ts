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
};
