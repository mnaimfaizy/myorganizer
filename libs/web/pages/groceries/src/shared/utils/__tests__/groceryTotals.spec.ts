import type { CatalogItem, ListLine } from '@myorganizer/core';
import { summarizeListSpend } from '../groceryTotals';

describe('summarizeListSpend', () => {
  const item = (id: string, price?: number): CatalogItem => ({
    id,
    name: id,
    category: 'other',
    ...(price === undefined ? {} : { price }),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const line = (
    id: string,
    catalogItemId: string,
    checked = false,
  ): ListLine => ({
    id,
    catalogItemId,
    checked,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  it('sums each priced line once and counts only checked priced lines in checkedKnown', () => {
    expect(
      summarizeListSpend(
        [line('l1', 'a', true), line('l2', 'a'), line('l3', 'b', true)],
        [item('a', 2.5), item('b', 4)],
      ),
    ).toEqual({
      known: 9,
      pricedCount: 3,
      unpricedCount: 0,
      checkedKnown: 6.5,
    });
  });

  it('does not treat missing, non-numeric, or stale catalog prices as zero', () => {
    expect(
      summarizeListSpend(
        [
          line('l1', 'missing'),
          line('l2', 'no-price'),
          line('l3', 'nan', true),
        ],
        [item('no-price'), item('nan', Number.NaN)],
      ),
    ).toEqual({ known: 0, pricedCount: 0, unpricedCount: 3, checkedKnown: 0 });
  });
});
