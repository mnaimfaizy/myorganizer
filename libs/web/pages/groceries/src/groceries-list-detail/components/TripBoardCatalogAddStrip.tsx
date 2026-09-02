'use client';

import type { CatalogItem, GroceryList } from '@myorganizer/core';
import { Input, cn } from '@myorganizer/web-ui';
import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import { getCategoryEmoji } from '../../shared/constants/categories';
import { formatMoney } from '../../shared/utils';

interface TripBoardCatalogAddStripProps {
  catalog: CatalogItem[];
  lists: GroceryList[];
  currentListId: string;
  onAdd: (catalogItemId: string) => void;
  onOpenMultiListDialog: () => void;
  isLoading?: boolean;
}

function getCatalogItemListCount(
  catalogItemId: string,
  lists: GroceryList[],
): number {
  return lists.filter((list) =>
    list.lines.some((line) => line.catalogItemId === catalogItemId),
  ).length;
}

function isCatalogItemOnList(
  catalogItemId: string,
  listId: string,
  lists: GroceryList[],
): boolean {
  const list = lists.find((entry) => entry.id === listId);
  return (
    list?.lines.some((line) => line.catalogItemId === catalogItemId) ?? false
  );
}

export function TripBoardCatalogAddStrip({
  catalog,
  lists,
  currentListId,
  onAdd,
  onOpenMultiListDialog,
  isLoading = false,
}: TripBoardCatalogAddStripProps) {
  const [query, setQuery] = useState('');

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? catalog.filter((item) => item.name.toLowerCase().includes(q))
      : catalog;
    return base.slice(0, 12);
  }, [catalog, query]);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    [],
  );

  return (
    <div className="space-y-2">
      <Input
        type="search"
        value={query}
        onChange={handleQueryChange}
        placeholder="Add from catalog — type to search…"
        aria-label="Catalog autocomplete for add to list"
        className="text-sm"
        disabled={isLoading}
      />
      <div className="flex flex-wrap gap-2">
        {suggestions.map((item) => {
          const onCurrentList = isCatalogItemOnList(
            item.id,
            currentListId,
            lists,
          );
          const listCount = getCatalogItemListCount(item.id, lists);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onAdd(item.id)}
              disabled={onCurrentList || isLoading}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                onCurrentList
                  ? 'border-border/50 bg-muted text-muted-foreground'
                  : 'border-border bg-card hover:border-brand',
              )}
              aria-label={
                onCurrentList
                  ? `${item.name} already on list`
                  : `Add ${item.name} to list`
              }
            >
              <span aria-hidden="true">{getCategoryEmoji(item.category)}</span>
              {item.name}
              {typeof item.price === 'number' ? (
                <span className="tabular-nums text-xs opacity-70">
                  {formatMoney(item.price)}
                </span>
              ) : null}
              {listCount > 1 && (
                <span className="rounded bg-muted px-1 text-[10px] font-bold text-accent-foreground">
                  {listCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onOpenMultiListDialog}
        disabled={isLoading}
        className="text-xs font-semibold text-foreground hover:underline focus-visible:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline disabled:opacity-50"
      >
        Add to multiple lists…
      </button>
    </div>
  );
}
