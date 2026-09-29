import type { TabName } from './tabs';

/**
 * The Details tab, named out of the one tab vocabulary rather than as a loose
 * string — see `groceriesStack.ts`, which this mirrors.
 */
type DetailsTab = Extract<TabName, 'Details'>;

/**
 * The Details tab's own navigation stack: its list, one Address's detail, and
 * one Mobile Number's detail. Creating or editing any of the three stays
 * web-only for this slice — nothing here pushes a create or edit screen.
 */
export type DetailsStackParamList = {
  [Home in `${DetailsTab}Home`]: undefined;
} & {
  /** One Address's detail — every field, Usage Locations, and the explicit
   * Copy / Open in Maps / Share actions. */
  AddressDetail: { addressId: string };
  /** One Mobile Number's detail. See `AddressDetail`. */
  MobileNumberDetail: { mobileNumberId: string };
};

/** The route names, in one place — see `GROCERIES_ROUTES` for why. */
export const DETAILS_ROUTES = {
  home: 'DetailsHome',
  addressDetail: 'AddressDetail',
  mobileNumberDetail: 'MobileNumberDetail',
} as const satisfies Record<string, keyof DetailsStackParamList>;
