'use client';

import type {
  CatalogItem,
  GroceryCategoryType,
  GroceryList,
} from '@myorganizer/core';
import { Edit2, Plus } from 'lucide-react';
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
  onNewStaple: () => void;
  onEditCatalogItem: (catalogItemId: string) => void;
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
  onNewStaple,
  onEditCatalogItem,
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
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="staples-catalog-heading"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          Staples catalog ({allCatalog.length})
        </h2>
        <button
          type="button"
          onClick={onNewStaple}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1 py-0.5 text-xs font-semibold text-foreground transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          aria-label="New staple"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New staple
        </button>
      </div>

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
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            selectedCategory === 'all'
              ? 'bg-brand text-brand-foreground'
              : 'bg-muted text-accent-foreground'
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
            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              selectedCategory === category
                ? 'bg-brand text-brand-foreground'
                : 'bg-muted text-accent-foreground'
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
            className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
            role="status"
          >
            {allCatalog.length === 0
              ? 'No staples yet — add one to seed the catalog.'
              : 'No catalog matches'}
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
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-background px-3 py-2.5"
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
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onEditCatalogItem(item.id)}
                    disabled={isLoading}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50"
                    aria-label={`Edit catalog item ${item.name}`}
                  >
                    <Edit2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="text-right">
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
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
