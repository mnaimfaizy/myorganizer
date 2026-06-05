'use client';

import type { GroceryList } from '@myorganizer/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@myorganizer/web-ui';
import { MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface GroceryListSelectorProps {
  lists: GroceryList[];
  selectedListIds: string[];
  onSelectLists: (ids: string[]) => void;
  onRenameList: (id: string) => void;
  onDeleteList: (id: string) => void;
  isLoading?: boolean;
}

// Category icon map for visual variety
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

// Get category from items or use default
function getDominantCategory(items: any[]): string {
  if (items.length === 0) return 'other';
  const categories = items.map((item) => item.category);
  const counts: Record<string, number> = {};
  for (const cat of categories) {
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0];
}

// Format timestamp to relative time
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
  selectedListIds,
  onSelectLists,
  onRenameList,
  onDeleteList,
  isLoading = false,
}: GroceryListSelectorProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleToggleSelect = (listId: string) => {
    if (selectedListIds.includes(listId)) {
      onSelectLists(selectedListIds.filter((id) => id !== listId));
    } else {
      onSelectLists([...selectedListIds, listId]);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-on-surface md:text-xl">
        Active Lists
        <span className="ml-2 text-sm text-secondary">{lists.length}</span>
      </h2>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => {
          const dominantCategory = getDominantCategory(list.items);
          const icon = CATEGORY_ICONS[dominantCategory];
          const checkedCount = list.items.filter((item) => item.checked).length;
          const isSelected = selectedListIds.includes(list.id);
          const progressPercent =
            list.items.length > 0
              ? Math.round((checkedCount / list.items.length) * 100)
              : 0;

          return (
            <div
              key={list.id}
              className={`group relative rounded-lg border-2 bg-surface-container-lowest p-4 transition-all md:p-5 ${
                isSelected
                  ? 'border-secondary shadow-md'
                  : 'border-surface-variant hover:border-secondary/50 hover:bg-surface-container-low'
              } ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
              role="article"
            >
              {/* Content */}
              <div className="relative">
                {/* Header with checkbox and menu */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(list.id)}
                      className="h-5 w-5 cursor-pointer rounded border-2 border-on-surface-variant accent-secondary"
                      aria-label={`Select ${list.name}`}
                      disabled={isLoading}
                    />
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-xl">
                      {icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-on-surface md:text-sm">
                        {list.name}
                      </h3>
                      <p className="text-xs text-text-muted md:text-xs">
                        {dominantCategory.replace('-', ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Context menu */}
                  <DropdownMenu
                    open={openMenuId === list.id}
                    onOpenChange={(open) =>
                      setOpenMenuId(open ? list.id : null)
                    }
                  >
                    <DropdownMenuTrigger
                      className="rounded p-1 opacity-0 transition-opacity hover:bg-surface-container group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4 text-on-surface-variant" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onRenameList(list.id);
                          setOpenMenuId(null);
                        }}
                      >
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-error focus:bg-error/10 focus:text-error"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteList(list.id);
                          setOpenMenuId(null);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Item count and timestamp */}
                <div className="mb-3 flex items-center justify-between text-xs text-on-surface-variant">
                  <span>
                    {checkedCount} / {list.items.length} items
                  </span>
                  <span>Updated {formatRelativeTime(list.updatedAt)}</span>
                </div>

                {/* Progress bar */}
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
