'use client';

import type { CatalogItem, GroceryList, ListLine } from '@myorganizer/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@myorganizer/web-ui';
import { MoreVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { formatMoney, summarizeListSpend } from '../../shared/utils';

interface GroceryListSelectorProps {
  lists: GroceryList[];
  catalog: CatalogItem[];
  onRenameList: (id: string) => void;
  onDeleteList: (id: string) => void;
  isLoading?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  produce: '🥬',
  dairy: '🥛',
  meat: '🥩',
  seafood: '🦐',
  bakery: '🍞',
  frozen: '🧊',
  beverages: '☕',
  snacks: '🍿',
  condiments: '🍯',
  household: '🧹',
  'personal-care': '🧼',
  other: '🛒',
};

function getDominantCategory(
  lines: ListLine[],
  catalog: CatalogItem[],
): string {
  if (lines.length === 0) return 'other';
  const categories = lines.map((line) => {
    const catalogItem = catalog.find((item) => item.id === line.catalogItemId);
    return catalogItem?.category ?? 'other';
  });
  const counts: Record<string, number> = {};
  for (const cat of categories) {
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function GroceryListSelector({
  lists,
  catalog,
  onRenameList,
  onDeleteList,
  isLoading = false,
}: GroceryListSelectorProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  const handleStopPropagation = useCallback((event: MouseEvent) => {
    event.stopPropagation();
  }, []);

  const createMenuOpenChangeHandler = useCallback(
    (listId: string) => (open: boolean) => {
      setOpenMenuId(open ? listId : null);
    },
    [],
  );

  const createMenuActionHandler = useCallback(
    (action: 'rename' | 'delete', listId: string) => (event: MouseEvent) => {
      event.stopPropagation();
      if (action === 'rename') {
        onRenameList(listId);
      } else {
        onDeleteList(listId);
      }
      setOpenMenuId(null);
    },
    [onDeleteList, onRenameList],
  );

  const handleToggleSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const listId = event.currentTarget.dataset.listId;
      if (!listId) return;

      setSelectedListIds((currentIds) =>
        currentIds.includes(listId)
          ? currentIds.filter((id) => id !== listId)
          : [...currentIds, listId],
      );
    },
    [],
  );

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-on-surface md:text-xl">
        Active Lists
        <span className="ml-2 text-sm text-secondary">{lists.length}</span>
      </h2>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => {
          const dominantCategory = getDominantCategory(list.lines, catalog);
          const icon = CATEGORY_ICONS[dominantCategory];
          const checkedCount = list.lines.filter((line) => line.checked).length;
          const spendSummary = summarizeListSpend(list.lines, catalog);
          const isSelected = selectedListIds.includes(list.id);
          const progressPercent =
            list.lines.length > 0
              ? Math.round((checkedCount / list.lines.length) * 100)
              : 0;

          return (
            <div
              key={list.id}
              className={`group relative rounded-lg border-2 bg-surface-container-lowest p-4 transition-all md:p-5 ${
                isSelected
                  ? 'border-error shadow-md'
                  : 'border-surface-variant hover:border-secondary/50 hover:bg-surface-container-low'
              } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
              role="article"
            >
              <div className="relative">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      data-list-id={list.id}
                      onChange={handleToggleSelect}
                      className="h-5 w-5 cursor-pointer rounded border-2 border-on-surface-variant accent-error"
                      aria-label={`Select ${list.name} for deletion`}
                      disabled={isLoading}
                    />
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container text-xl">
                      {icon}
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/groceries/${list.id}`}
                    className="flex-1 rounded-lg px-2 py-1 transition-colors hover:bg-secondary-container/30"
                  >
                    <h3 className="font-semibold text-on-surface md:text-sm hover:underline">
                      {list.name}
                    </h3>
                    <p className="text-xs text-text-muted md:text-xs">
                      {dominantCategory.replace('-', ' ')}
                    </p>
                  </Link>

                  <DropdownMenu
                    open={openMenuId === list.id}
                    onOpenChange={createMenuOpenChangeHandler(list.id)}
                  >
                    <DropdownMenuTrigger
                      className="flex-shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-surface-container group-hover:opacity-100"
                      onClick={handleStopPropagation}
                      aria-label={`More actions for ${list.name}`}
                    >
                      <MoreVertical className="h-4 w-4 text-on-surface-variant" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={createMenuActionHandler('rename', list.id)}
                      >
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-error focus:bg-error/10 focus:text-error"
                        onClick={createMenuActionHandler('delete', list.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mb-3 flex items-center justify-between text-xs text-on-surface-variant">
                  <span>
                    {checkedCount} / {list.lines.length} items
                  </span>
                  <span>Updated {formatRelativeTime(list.updatedAt)}</span>
                </div>

                <div
                  className="mb-3 flex items-center justify-between gap-3 text-xs"
                  aria-label={`Known spend ${formatMoney(spendSummary.known)}; ${spendSummary.unpricedCount} item${spendSummary.unpricedCount !== 1 ? 's' : ''} unpriced`}
                >
                  <span className="font-semibold text-on-surface">
                    Known spend {formatMoney(spendSummary.known)}
                  </span>
                  <span className="text-on-surface-variant">
                    {spendSummary.unpricedCount} item
                    {spendSummary.unpricedCount !== 1 ? 's' : ''} unpriced
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className={`h-full transition-all ${
                      isSelected ? 'bg-secondary' : 'bg-action-cyan'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
