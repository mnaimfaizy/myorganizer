import { selectSubscriptionListView } from './subscriptionModel';

describe('subscriptionModel', () => {
  describe('selectSubscriptionListView', () => {
    const now = new Date(2026, 0, 15); // Jan 15, 2026 in local time

    describe('renewingSoon bucket on active filter', () => {
      it('includes subscriptions renewing today (0 days from now)', () => {
        const records = [
          {
            id: 'sub1',
            status: 'active' as const,
            nextBillingDate: '2026-01-15',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.renewingSoon).toHaveLength(1);
        expect(result.renewingSoon[0].id).toBe('sub1');
      });

      it('includes subscriptions renewing within 7 days (boundary: 7 days counts)', () => {
        const records = [
          {
            id: 'sub-7days',
            status: 'active' as const,
            nextBillingDate: '2026-01-22', // 7 days from Jan 15
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.renewingSoon).toHaveLength(1);
        expect(result.renewingSoon[0].id).toBe('sub-7days');
      });

      it('excludes subscriptions renewing in 8+ days', () => {
        const records = [
          {
            id: 'sub-8days',
            status: 'active' as const,
            nextBillingDate: '2026-01-23', // 8 days from Jan 15
          },
          {
            id: 'sub-active-item',
            status: 'active' as const,
            nextBillingDate: '2026-01-23',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.renewingSoon).toHaveLength(0);
        expect(result.items).toHaveLength(2);
        expect(result.items.map((s) => s.id)).toContain('sub-8days');
      });

      it('never includes subscriptions without nextBillingDate in renewingSoon', () => {
        const records = [
          {
            id: 'sub-no-date',
            status: 'active' as const,
            // no nextBillingDate
          },
          {
            id: 'sub-with-date',
            status: 'active' as const,
            nextBillingDate: '2026-01-16',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.renewingSoon).toHaveLength(1);
        expect(result.renewingSoon[0].id).toBe('sub-with-date');
        expect(result.renewingSoon.some((s) => s.id === 'sub-no-date')).toBe(
          false,
        );
      });

      it('sorts renewingSoon by nextBillingDate ascending', () => {
        const records = [
          {
            id: 'sub-day3',
            status: 'active' as const,
            nextBillingDate: '2026-01-18',
          },
          {
            id: 'sub-day1',
            status: 'active' as const,
            nextBillingDate: '2026-01-16',
          },
          {
            id: 'sub-day7',
            status: 'active' as const,
            nextBillingDate: '2026-01-22',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.renewingSoon).toHaveLength(3);
        expect(result.renewingSoon[0].id).toBe('sub-day1');
        expect(result.renewingSoon[1].id).toBe('sub-day3');
        expect(result.renewingSoon[2].id).toBe('sub-day7');
      });
    });

    describe('renewingSoon on non-active filters', () => {
      it('always returns empty renewingSoon for cancelled filter', () => {
        const records = [
          {
            id: 'sub-cancelled',
            status: 'cancelled' as const,
            nextBillingDate: '2026-01-16', // Within 7 days
          },
        ];

        const result = selectSubscriptionListView(records, 'cancelled', now);

        expect(result.renewingSoon).toHaveLength(0);
        expect(result.items).toHaveLength(1);
      });

      it('always returns empty renewingSoon for inactive filter', () => {
        const records = [
          {
            id: 'sub-inactive',
            status: 'inactive' as const,
            nextBillingDate: '2026-01-16',
          },
        ];

        const result = selectSubscriptionListView(records, 'inactive', now);

        expect(result.renewingSoon).toHaveLength(0);
        expect(result.items).toHaveLength(1);
      });

      it('always returns empty renewingSoon for expired filter', () => {
        const records = [
          {
            id: 'sub-expired',
            status: 'expired' as const,
            nextBillingDate: '2026-01-16',
          },
        ];

        const result = selectSubscriptionListView(records, 'expired', now);

        expect(result.renewingSoon).toHaveLength(0);
        expect(result.items).toHaveLength(1);
      });
    });

    describe('active filter includes pending status', () => {
      it('includes pending subscriptions in both renewingSoon and items', () => {
        const records = [
          {
            id: 'sub-pending-soon',
            status: 'pending' as const,
            nextBillingDate: '2026-01-16',
          },
          {
            id: 'sub-pending-later',
            status: 'pending' as const,
            nextBillingDate: '2026-01-25',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.renewingSoon).toHaveLength(1);
        expect(result.renewingSoon[0].id).toBe('sub-pending-soon');
        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe('sub-pending-later');
      });

      it('mixes active and pending in renewingSoon when both match', () => {
        const records = [
          {
            id: 'sub-active',
            status: 'active' as const,
            nextBillingDate: '2026-01-16',
          },
          {
            id: 'sub-pending',
            status: 'pending' as const,
            nextBillingDate: '2026-01-17',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.renewingSoon).toHaveLength(2);
        const ids = result.renewingSoon.map((s) => s.id);
        expect(ids).toContain('sub-active');
        expect(ids).toContain('sub-pending');
      });
    });

    describe('items bucket sorting', () => {
      it('sorts items by nextBillingDate ascending', () => {
        const records = [
          {
            id: 'sub-jan25',
            status: 'active' as const,
            nextBillingDate: '2026-01-25', // Beyond 7 days, goes to items
          },
          {
            id: 'sub-jan30',
            status: 'active' as const,
            nextBillingDate: '2026-01-30', // Beyond 7 days, goes to items
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.items).toHaveLength(2);
        expect(result.items[0].id).toBe('sub-jan25');
        expect(result.items[1].id).toBe('sub-jan30');
      });

      it('places subscriptions without nextBillingDate last, on active filter', () => {
        const records = [
          {
            id: 'sub-no-date1',
            status: 'active' as const,
          },
          {
            id: 'sub-jan25',
            status: 'active' as const,
            nextBillingDate: '2026-01-25', // Beyond 7 days, goes to items
          },
          {
            id: 'sub-no-date2',
            status: 'active' as const,
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        expect(result.items).toHaveLength(3);
        // Dated one first
        expect(result.items[0].id).toBe('sub-jan25');
        // Undated ones last (order among them is stable but unspecified)
        expect(result.items[1].id).toMatch(/^sub-no-date/);
        expect(result.items[2].id).toMatch(/^sub-no-date/);
      });

      it('places subscriptions without nextBillingDate last, on inactive filter', () => {
        const records = [
          {
            id: 'sub-no-date1',
            status: 'inactive' as const,
          },
          {
            id: 'sub-jan20',
            status: 'inactive' as const,
            nextBillingDate: '2026-01-20',
          },
          {
            id: 'sub-no-date2',
            status: 'inactive' as const,
          },
        ];

        const result = selectSubscriptionListView(records, 'inactive', now);

        expect(result.items).toHaveLength(3);
        expect(result.items[0].id).toBe('sub-jan20');
        expect([result.items[1].id, result.items[2].id]).toContain(
          'sub-no-date1',
        );
        expect([result.items[1].id, result.items[2].id]).toContain(
          'sub-no-date2',
        );
      });
    });

    describe('no overlap between renewingSoon and items', () => {
      it('excludes renewingSoon subscriptions from items', () => {
        const records = [
          {
            id: 'sub-renewing-soon',
            status: 'active' as const,
            nextBillingDate: '2026-01-16',
          },
          {
            id: 'sub-item',
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        const renewingSoonIds = new Set(result.renewingSoon.map((s) => s.id));
        const itemIds = new Set(result.items.map((s) => s.id));

        expect(renewingSoonIds.has('sub-renewing-soon')).toBe(true);
        expect(itemIds.has('sub-renewing-soon')).toBe(false);
        expect(itemIds.has('sub-item')).toBe(true);
      });

      it('ensures no subscription appears in both buckets across multiple statuses', () => {
        const records = [
          {
            id: 'sub-active-soon',
            status: 'active' as const,
            nextBillingDate: '2026-01-16',
          },
          {
            id: 'sub-pending-soon',
            status: 'pending' as const,
            nextBillingDate: '2026-01-17',
          },
          {
            id: 'sub-active-later',
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        const renewingSoonIds = new Set(result.renewingSoon.map((s) => s.id));
        const allItemIds = result.items.map((s) => s.id);

        for (const id of allItemIds) {
          expect(renewingSoonIds.has(id)).toBe(false);
        }
      });
    });

    describe('filter matching', () => {
      it('active filter matches active and pending, excludes others', () => {
        const records = [
          {
            id: 'sub-active',
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-pending',
            status: 'pending' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-inactive',
            status: 'inactive' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-cancelled',
            status: 'cancelled' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-expired',
            status: 'expired' as const,
            nextBillingDate: '2026-01-25',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        const allIds = new Set([
          ...result.renewingSoon.map((s) => s.id),
          ...result.items.map((s) => s.id),
        ]);

        expect(allIds.has('sub-active')).toBe(true);
        expect(allIds.has('sub-pending')).toBe(true);
        expect(allIds.has('sub-inactive')).toBe(false);
        expect(allIds.has('sub-cancelled')).toBe(false);
        expect(allIds.has('sub-expired')).toBe(false);
      });

      it('inactive filter matches only inactive, excludes all others', () => {
        const records = [
          {
            id: 'sub-active',
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-pending',
            status: 'pending' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-inactive',
            status: 'inactive' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-cancelled',
            status: 'cancelled' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-expired',
            status: 'expired' as const,
            nextBillingDate: '2026-01-25',
          },
        ];

        const result = selectSubscriptionListView(records, 'inactive', now);

        const allIds = new Set([
          ...result.renewingSoon.map((s) => s.id),
          ...result.items.map((s) => s.id),
        ]);

        expect(allIds.has('sub-inactive')).toBe(true);
        expect(allIds.has('sub-active')).toBe(false);
        expect(allIds.has('sub-pending')).toBe(false);
        expect(allIds.has('sub-cancelled')).toBe(false);
        expect(allIds.has('sub-expired')).toBe(false);
      });

      it('cancelled filter matches only cancelled', () => {
        const records = [
          {
            id: 'sub-active',
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-cancelled',
            status: 'cancelled' as const,
            nextBillingDate: '2026-01-25',
          },
        ];

        const result = selectSubscriptionListView(records, 'cancelled', now);

        const allIds = new Set([
          ...result.renewingSoon.map((s) => s.id),
          ...result.items.map((s) => s.id),
        ]);

        expect(allIds.has('sub-cancelled')).toBe(true);
        expect(allIds.has('sub-active')).toBe(false);
      });

      it('expired filter matches only expired', () => {
        const records = [
          {
            id: 'sub-active',
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: 'sub-expired',
            status: 'expired' as const,
            nextBillingDate: '2026-01-25',
          },
        ];

        const result = selectSubscriptionListView(records, 'expired', now);

        const allIds = new Set([
          ...result.renewingSoon.map((s) => s.id),
          ...result.items.map((s) => s.id),
        ]);

        expect(allIds.has('sub-expired')).toBe(true);
        expect(allIds.has('sub-active')).toBe(false);
      });
    });

    describe('malformed and edge cases', () => {
      it('returns empty arrays when records is not an array', () => {
        expect(selectSubscriptionListView(null, 'active', now)).toEqual({
          renewingSoon: [],
          items: [],
        });
        expect(selectSubscriptionListView(undefined, 'active', now)).toEqual({
          renewingSoon: [],
          items: [],
        });
        expect(
          selectSubscriptionListView('not an array', 'active', now),
        ).toEqual({
          renewingSoon: [],
          items: [],
        });
        expect(selectSubscriptionListView({}, 'active', now)).toEqual({
          renewingSoon: [],
          items: [],
        });
      });

      it('drops entries without a valid id', () => {
        const records = [
          {
            id: 'valid-sub',
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            id: '',
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
          {
            status: 'active' as const,
            nextBillingDate: '2026-01-25',
          },
          null,
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        const allIds = [
          ...result.renewingSoon.map((s) => s.id),
          ...result.items.map((s) => s.id),
        ];

        expect(allIds).toHaveLength(1);
        expect(allIds[0]).toBe('valid-sub');
      });

      it('handles subscriptions with missing status (defaults to active)', () => {
        const records = [
          {
            id: 'sub-no-status',
            nextBillingDate: '2026-01-16',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        // Missing status defaults to 'active', so it should match the active filter
        expect(result.renewingSoon).toHaveLength(1);
        expect(result.renewingSoon[0].id).toBe('sub-no-status');
      });

      it('returns empty result for empty records array', () => {
        const result = selectSubscriptionListView([], 'active', now);

        expect(result).toEqual({ renewingSoon: [], items: [] });
      });
    });

    describe('boundary and date math', () => {
      it('uses local calendar day for 7-day boundary, not UTC', () => {
        // Construct dates in local time (not UTC parsing)
        const localNow = new Date(2026, 0, 15); // Jan 15 local

        // Format as ISO date string to match the YYYY-MM-DD format
        const records = [
          {
            id: 'sub-7days-boundary',
            status: 'active' as const,
            nextBillingDate: '2026-01-22',
          },
        ];

        const result = selectSubscriptionListView(records, 'active', localNow);

        expect(result.renewingSoon).toHaveLength(1);
        expect(result.renewingSoon[0].id).toBe('sub-7days-boundary');
      });

      it('handles past dates correctly (overdue subscriptions not in renewingSoon)', () => {
        const records = [
          {
            id: 'sub-overdue',
            status: 'active' as const,
            nextBillingDate: '2026-01-10', // Before now (Jan 15)
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        // Overdue (negative days) should not be in renewingSoon
        expect(result.renewingSoon).toHaveLength(0);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe('sub-overdue');
      });

      it('sorts correctly when mixing overdue, renewing soon, and future dates', () => {
        const records = [
          {
            id: 'sub-jan30',
            status: 'active' as const,
            nextBillingDate: '2026-01-30', // Beyond 7 days
          },
          {
            id: 'sub-jan10',
            status: 'active' as const,
            nextBillingDate: '2026-01-10', // Overdue
          },
          {
            id: 'sub-jan18',
            status: 'active' as const,
            nextBillingDate: '2026-01-18', // 3 days away, within 7 days
          },
        ];

        const result = selectSubscriptionListView(records, 'active', now);

        // renewingSoon contains Jan 18 (within 7 days, >= 0 days away)
        expect(result.renewingSoon.map((s) => s.id)).toEqual(['sub-jan18']);

        // items contains Jan 10 (overdue) and Jan 30 (after 7 days), sorted ascending
        expect(result.items.map((s) => s.id)).toEqual([
          'sub-jan10',
          'sub-jan30',
        ]);
      });
    });
  });
});
