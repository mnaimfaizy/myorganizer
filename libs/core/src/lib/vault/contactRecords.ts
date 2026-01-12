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
  address: string;
  status: AddressStatus;
  usageLocations: UsageLocationRecord[];
  createdAt: IsoDateTimeString;
};

export type MobileNumberRecord = {
  id: string;
  label: string;
  mobileNumber: string;
  usageLocations: UsageLocationRecord[];
  createdAt: IsoDateTimeString;
};
