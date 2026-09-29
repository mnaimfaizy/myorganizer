import {
  monthlyEquivalentAmount,
  type CurrencyCode,
  type SubscriptionRecord,
  type SubscriptionStatus,
} from '@myorganizer/vault-core/portable';

/**
 * What the Subscriptions screens read out of a decrypted Subscriptions Vault
 * Blob.
 *
 * The payload is decrypted JSON written by some build of some client, so
 * every field but `id` is a claim — the same defensive reading
 * `taskModel.ts` and `groceryTripModel.ts` do for their own Vault Blob Types.
 * This module holds no React and imports no `react-native`, which is what
 * lets `libs/mobile/screens`' Jest project — a `node` environment with no
 * renderer — cover it.
 */
export type DecryptedSubscription = Partial<SubscriptionRecord> & {
  id: string;
};

/**
 * The List screen's four-way filter. Pending is not one of these — it is
 * shown grouped under Active with its own pill (CONTEXT.md), so the filter
 * itself only ever asks about the other four statuses.
 */
export type SubscriptionListFilter =
  | 'active'
  | 'inactive'
  | 'cancelled'
  | 'expired';

/** The unfiltered "renews within a week" window, in days. */
const RENEWING_SOON_DAYS = 7;

/** Unambiguous per-currency prefixes (CurrencyCode's own five). */
const CURRENCY_PREFIXES = {
  AUD: 'A$',
  USD: 'US$',
  EUR: '€',
  GBP: '£',
  NZD: 'NZ$',
} as const satisfies Record<CurrencyCode, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDecryptedSubscription(entry: unknown): DecryptedSubscription | null {
  if (!isRecord(entry)) return null;
  return typeof entry.id === 'string' && entry.id.length > 0
    ? (entry as DecryptedSubscription)
    : null;
}

function readVisibleSubscriptions(records: unknown): DecryptedSubscription[] {
  if (!Array.isArray(records)) return [];
  const subscriptions: DecryptedSubscription[] = [];
  for (const entry of records) {
    const subscription = toDecryptedSubscription(entry);
    if (subscription !== null) subscriptions.push(subscription);
  }
  return subscriptions;
}

/** The one Subscription with `id`, or `null` when the payload holds none —
 * deleted on another device while this screen was open. */
export function findVisibleSubscription(
  records: unknown,
  id: string,
): DecryptedSubscription | null {
  return readVisibleSubscriptions(records).find((sub) => sub.id === id) ?? null;
}

/** A Subscription's status, defaulting to `active` when the payload carries
 * none — the same "oldest data has no opinion" default `taskModel.ts` gives
 * a missing status. */
export function subscriptionStatus(
  subscription: DecryptedSubscription,
): SubscriptionStatus {
  return subscription.status ?? 'active';
}

/**
 * Whether `subscription` belongs on the List screen's `filter` tab. The
 * Active tab also carries Pending — it is shown there with its own pill
 * rather than in a filter of its own (CONTEXT.md).
 */
function matchesFilter(
  subscription: DecryptedSubscription,
  filter: SubscriptionListFilter,
): boolean {
  const status = subscriptionStatus(subscription);
  if (filter === 'active') return status === 'active' || status === 'pending';
  return status === filter;
}

/**
 * `value`'s calendar date, read as three local components — the same
 * boundary-safe parse `taskModel.ts` uses for a due date, so a next billing
 * date compares against "today" the same way a Task's due date does.
 */
function parseDateOnly(
  value: string,
): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match === null) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function startOfLocalDay(y: number, m: number, d: number): number {
  return new Date(y, m, d).getTime();
}

/** Calendar days from `now`'s local day to `dateOnly`'s, or `null` when
 * `dateOnly` does not parse. Negative means the date has already passed. */
function daysUntil(dateOnly: string, now: Date): number | null {
  const parsed = parseDateOnly(dateOnly);
  if (parsed === null) return null;
  const due = startOfLocalDay(parsed.y, parsed.m, parsed.d);
  const today = startOfLocalDay(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  return Math.round((due - today) / (24 * 60 * 60 * 1000));
}

/** Whether `subscription` renews within the next seven days (today included).
 * A Subscription with no next billing date is never Renewing soon — it has
 * nothing to be soon about. */
function isRenewingSoon(
  subscription: DecryptedSubscription,
  now: Date,
): boolean {
  if (subscription.nextBillingDate == null) return false;
  const days = daysUntil(subscription.nextBillingDate, now);
  return days !== null && days >= 0 && days <= RENEWING_SOON_DAYS;
}

/**
 * Orders by next billing date ascending; a Subscription with no next billing
 * date sorts last, whichever filter tab it is on. Both dates are
 * `IsoDateTimeString`, so a lexicographic compare is a chronological one.
 */
function compareByNextBillingDate(
  a: DecryptedSubscription,
  b: DecryptedSubscription,
): number {
  const aHas = a.nextBillingDate != null;
  const bHas = b.nextBillingDate != null;
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  if (!aHas && !bHas) return 0;
  return (a.nextBillingDate as string).localeCompare(
    b.nextBillingDate as string,
  );
}

/** What the List screen renders for one filter tab: the Renewing soon bucket
 * (Active tab only — CONTEXT.md's Monthly Equivalent card is Active-only for
 * the same reason), then the rest, ordered by next billing date with no date
 * sorting last. The two never overlap: a Subscription placed in `renewingSoon`
 * is not repeated in `items`. */
export interface SubscriptionListView {
  renewingSoon: DecryptedSubscription[];
  items: DecryptedSubscription[];
}

export function selectSubscriptionListView(
  records: unknown,
  filter: SubscriptionListFilter,
  now: Date,
): SubscriptionListView {
  const matching = readVisibleSubscriptions(records).filter((subscription) =>
    matchesFilter(subscription, filter),
  );

  const renewingSoon =
    filter === 'active'
      ? matching
          .filter((subscription) => isRenewingSoon(subscription, now))
          .sort(compareByNextBillingDate)
      : [];

  const renewingSoonIds = new Set(
    renewingSoon.map((subscription) => subscription.id),
  );
  const items = matching
    .filter((subscription) => !renewingSoonIds.has(subscription.id))
    .sort(compareByNextBillingDate);

  return { renewingSoon, items };
}

/**
 * The Monthly Equivalent summed per currency, over the Subscriptions this
 * screen can already see. Mobile keeps no `normalizeSubscriptions` validation
 * pass (that lives in `@myorganizer/web-vault`, a web-only library) — a
 * decrypted record here is only ever a `DecryptedSubscription` claim, so this
 * checks the three fields `monthlyEquivalentAmount` reads are actually
 * present before calling it, and skips a record missing any of them rather
 * than propagating a `NaN` into a currency's total. The arithmetic itself —
 * the factor table and the per-record calculation — is not reimplemented
 * here; only the defensive field check and the per-currency grouping are.
 */
export function calculateVisibleMonthlyEquivalents(
  subscriptions: readonly DecryptedSubscription[],
): Array<{ currency: CurrencyCode; amount: number }> {
  const totals = new Map<CurrencyCode, number>();
  for (const subscription of subscriptions) {
    if (subscriptionStatus(subscription) !== 'active') continue;
    if (
      subscription.amount == null ||
      subscription.billingCycle == null ||
      subscription.currency == null
    ) {
      continue;
    }
    const amount = monthlyEquivalentAmount(subscription as SubscriptionRecord);
    totals.set(
      subscription.currency,
      (totals.get(subscription.currency) ?? 0) + amount,
    );
  }
  return Array.from(totals.entries()).map(([currency, amount]) => ({
    currency,
    amount,
  }));
}

/** "Renews in n days", read against `now`'s local calendar day — or "No
 * renewal date" when there is nothing to count down to. */
export function describeRenewal(
  subscription: DecryptedSubscription,
  now: Date,
): string {
  if (subscription.nextBillingDate == null) return 'No renewal date';
  const days = daysUntil(subscription.nextBillingDate, now);
  if (days === null) return 'No renewal date';
  if (days < 0) return 'Renewal overdue';
  if (days === 0) return 'Renews today';
  if (days === 1) return 'Renews tomorrow';
  return `Renews in ${days} days`;
}

function withThousands(fixed: string): string {
  const negative = fixed.startsWith('-');
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [whole, decimals] = unsigned.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${decimals}`;
}

/** An amount with an unambiguous currency prefix — `A$`, `US$`, `NZ$`, `€`,
 * `£` — never a bare `$`, which reads as three different currencies here. */
export function formatSubscriptionAmount(
  amount: number,
  currency: CurrencyCode,
): string {
  return `${CURRENCY_PREFIXES[currency]}${withThousands(amount.toFixed(2))}`;
}
