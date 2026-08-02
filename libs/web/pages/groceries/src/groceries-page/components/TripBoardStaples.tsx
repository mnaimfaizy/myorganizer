'use client';

import type {
  CatalogItem,
  GroceryCategoryType,
  GroceryList,
} from '@myorganizer/core';
import { useCallback, useMemo } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getCategoryEmoji,
  getCategoryLabel,
} from '../../shared/constants/categories';
import { formatMoney } from '../../shared/utils';

interface TripBoardStaplesProps {
  catalog: CatalogItem[];
  allCatalog: CatalogItem[];
  lists: GroceryList[];
  selectedCategory: GroceryCategoryType | 'all';
  onSelectCategory: (category: GroceryCategoryType | 'all') => void;
  onAddToTrip: (catalogItemId: string) => void;
  isLoading?: boolean;
}

function buildCatalogListCounts(lists: GroceryList[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const list of lists) {
    const catalogIdsOnList = new Set(
      list.lines.map((line) => line.catalogItemId),
    );

    for (const catalogItemId of catalogIdsOnList) {
      counts.set(catalogItemId, (counts.get(catalogItemId) ?? 0) + 1);
    }
  }

  return counts;
}

export function TripBoardStaples({
  catalog,
  allCatalog,
  lists,
  selectedCategory,
  onSelectCategory,
  onAddToTrip,
  isLoading = false,
}: TripBoardStaplesProps) {
  const categoriesInUse = useMemo(() => {
    const categories = new Set(allCatalog.map((item) => item.category));
    return CATEGORY_ORDER.filter((category) => categories.has(category));
  }, [allCatalog]);

  const catalogListCounts = useMemo(
    () => buildCatalogListCounts(lists),
    [lists],
  );

  const createCategoryChangeHandler = useCallback(
    (category: GroceryCategoryType | 'all') => () => {
      onSelectCategory(category);
    },
    [onSelectCategory],
  );

  return (
    <section
      aria-labelledby="staples-catalog-heading"
      className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4"
    >
      <h2
        id="staples-catalog-heading"
        className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        Staples catalog ({allCatalog.length})
      </h2>

      <div
        className="mb-3 flex gap-2 overflow-x-auto py-1"
        role="group"
        aria-label="Filter staples by category"
      >
        <button
          type="button"
          aria-label="Show all staples"
          aria-pressed={selectedCategory === 'all'}
          onClick={createCategoryChangeHandler('all')}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
            selectedCategory === 'all'
              ? 'bg-secondary text-on-secondary'
              : 'bg-secondary-container text-on-secondary-container'
          }`}
        >
          All
        </button>
        {categoriesInUse.map((category) => (
          <button
            key={category}
            type="button"
            aria-label={`Filter staples by ${getCategoryLabel(category)}`}
            aria-pressed={selectedCategory === category}
            onClick={createCategoryChangeHandler(category)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
              selectedCategory === category
                ? 'bg-secondary text-on-secondary'
                : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            <span aria-hidden="true">{getCategoryEmoji(category)}</span>
            {getCategoryLabel(category)}
          </button>
        ))}
      </div>

      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {catalog.length === 0 ? (
          <li
            className="rounded-lg border border-dashed border-outline-variant p-4 text-center text-sm text-muted-foreground"
            role="status"
          >
            No catalog matches
          </li>
        ) : (
          catalog.map((item) => {
            const listCount = catalogListCounts.get(item.id) ?? 0;
            const onAllTrips = lists.length > 0 && listCount === lists.length;
            const metaParts = [
              CATEGORY_LABELS[item.category],
              ...(listCount > 1 ? [`on ${listCount} lists`] : []),
              ...(item.notes ? ['has notes'] : []),
            ];

            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-outline-variant/80 bg-surface px-3 py-2.5"
              >
                <span className="text-lg" aria-hidden="true">
                  {getCategoryEmoji(item.category)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metaParts.join(' · ')}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {typeof item.price === 'number'
                      ? formatMoney(item.price)
                      : '—'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onAddToTrip(item.id)}
                    disabled={onAllTrips || isLoading}
                    className="mt-1 text-xs font-semibold text-foreground hover:underline focus-visible:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                    aria-label={
                      onAllTrips
                        ? `${item.name} is on all trips`
                        : `Add ${item.name} to trip`
                    }
                  >
                    {onAllTrips ? 'On all trips' : 'Add to trip'}
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
