import type { TabName } from './tabs';

/**
 * The Subscriptions tab, named out of the one tab vocabulary rather than as a
 * loose string — see `groceriesStack.ts`, which this mirrors.
 */
type SubscriptionsTab = Extract<TabName, 'Subscriptions'>;

/** The Subscriptions tab's own navigation stack: its list, and one
 * Subscription's detail. */
export type SubscriptionsStackParamList = {
  [Home in `${SubscriptionsTab}Home`]: undefined;
} & {
  /** One Subscription's detail — every field, grouped, and Edit. */
  SubscriptionDetail: { subscriptionId: string };
};

/** The route names, in one place — see `GROCERIES_ROUTES` for why. */
export const SUBSCRIPTIONS_ROUTES = {
  home: 'SubscriptionsHome',
  detail: 'SubscriptionDetail',
} as const satisfies Record<string, keyof SubscriptionsStackParamList>;
