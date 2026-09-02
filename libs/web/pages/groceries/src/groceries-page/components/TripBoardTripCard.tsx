'use client';

import type {
  CatalogItem,
  GroceryCategoryType,
  GroceryList,
} from '@myorganizer/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@myorganizer/web-ui';
import { MoreVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { memo, useCallback, useMemo, useState } from 'react';
import { getCategoryEmoji } from '../../shared/constants/categories';
import {
  formatMoney,
  resolveCatalogItem,
  summarizeListSpend,
} from '../../shared/utils';

interface TripBoardTripCardProps {
  list: GroceryList;
  catalog: CatalogItem[];
  onRenameList: (id: string) => void;
  onDeleteList: (id: string) => void;
  isLoading?: boolean;
}

function getDominantCategory(
  list: GroceryList,
  catalog: CatalogItem[],
): GroceryCategoryType {
  const firstOpen = list.lines.find((line) => !line.checked);
  const targetLine = firstOpen ?? list.lines[0];
  if (!targetLine) return 'other';

  const catalogItem = resolveCatalogItem(targetLine, catalog);
  return catalogItem?.category ?? 'other';
}

export const TripBoardTripCard = memo(function TripBoardTripCard({
  list,
  catalog,
  onRenameList,
  onDeleteList,
  isLoading = false,
}: TripBoardTripCardProps) {
  const [openMenu, setOpenMenu] = useState(false);

  const spend = useMemo(
    () => summarizeListSpend(list.lines, catalog),
    [catalog, list.lines],
  );

  const checkedCount = useMemo(
    () => list.lines.filter((line) => line.checked).length,
    [list.lines],
  );

  const openCount = list.lines.length - checkedCount;
  const dominantCategory = useMemo(
    () => getDominantCategory(list, catalog),
    [catalog, list],
  );

  const activeLines = useMemo(
    () => list.lines.filter((line) => !line.checked),
    [list.lines],
  );

  const checkedLines = useMemo(
    () => list.lines.filter((line) => line.checked),
    [list.lines],
  );

  const progressPercent =
    list.lines.length > 0
      ? Math.round((checkedCount / list.lines.length) * 100)
      : 0;

  const handleMenuOpenChange = useCallback((open: boolean) => {
    setOpenMenu(open);
  }, []);

  const handleRename = useCallback(() => {
    onRenameList(list.id);
    setOpenMenu(false);
  }, [list.id, onRenameList]);

  const handleDelete = useCallback(() => {
    onDeleteList(list.id);
    setOpenMenu(false);
  }, [list.id, onDeleteList]);

  return (
    <article
      data-testid={`trip-card-${list.id}`}
      className={`flex w-80 shrink-0 flex-col rounded-2xl border border-border bg-card shadow-sm ${
        isLoading ? 'pointer-events-none opacity-60' : ''
      }`}
    >
      <div className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl" aria-hidden="true">
              {getCategoryEmoji(dominantCategory)}
            </span>
            <h3 className="min-w-0 truncate text-base font-bold text-foreground">
              <Link
                href={`/dashboard/groceries/${list.id}`}
                className="hover:underline"
              >
                {list.name}
              </Link>
            </h3>
          </div>
          <DropdownMenu open={openMenu} onOpenChange={handleMenuOpenChange}>
            <DropdownMenuTrigger
              className="rounded p-1 hover:bg-muted"
              aria-label={`Trip actions for ${list.name}`}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRename}>
                Rename trip
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete trip
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 tabular-nums">
          <p className="text-2xl font-bold text-foreground">
            {formatMoney(spend.known)}
          </p>
          <p className="text-xs text-muted-foreground">
            {spend.unpricedCount > 0
              ? `${spend.unpricedCount} unpriced`
              : 'all priced'}
          </p>
        </div>

        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {checkedCount}/{list.lines.length} checked · {openCount} open
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-1 p-3">
        <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Active ({openCount})
        </p>
        {activeLines.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">All checked</p>
        ) : (
          activeLines.slice(0, 5).map((line) => {
            const catalogItem = resolveCatalogItem(line, catalog);
            return (
              <div
                key={line.id}
                className="flex items-center gap-2 rounded-lg bg-background px-2 py-1.5 text-sm"
              >
                <span aria-hidden="true">
                  {getCategoryEmoji(catalogItem?.category ?? 'other')}
                </span>
                <span className="min-w-0 truncate">
                  {catalogItem?.name ?? 'Unknown item'}
                </span>
              </div>
            );
          })
        )}
        {openCount > 5 && (
          <p className="px-1 text-xs text-muted-foreground">
            +{openCount - 5} more open
          </p>
        )}

        <p className="mt-3 px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Checked ({checkedCount})
        </p>
        {checkedLines.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">None</p>
        ) : (
          checkedLines.slice(0, 3).map((line) => {
            const catalogItem = resolveCatalogItem(line, catalog);
            return (
              <div
                key={line.id}
                className="truncate px-2 py-1 text-xs text-muted-foreground line-through"
              >
                {catalogItem?.name ?? 'Unknown item'}
              </div>
            );
          })
        )}
      </div>

      <Link
        href={`/dashboard/groceries/${list.id}`}
        className="border-t border-border p-3 text-center text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        Open trip board →
      </Link>
    </article>
  );
});
