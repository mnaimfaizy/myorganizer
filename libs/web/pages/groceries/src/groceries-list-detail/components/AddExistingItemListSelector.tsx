'use client';

import type { GroceryList } from '@myorganizer/core';
import { Checkbox, Label } from '@myorganizer/web-ui';

interface AddExistingItemListSelectorProps {
  lists: GroceryList[];
  selectedListIds: Set<string>;
  onToggleList: (listId: string) => void;
  isLoading?: boolean;
}

export function AddExistingItemListSelector({
  lists,
  selectedListIds,
  onToggleList,
  isLoading = false,
}: AddExistingItemListSelectorProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
        Add to Lists
      </Label>
      <div className="space-y-2 rounded-lg border border-outline-variant p-3">
        {lists.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            There are no Grocery Lists yet.
          </p>
        ) : (
          lists.map((list) => (
            <label
              key={list.id}
              className="flex items-center gap-2 text-sm text-on-surface"
            >
              <Checkbox
                checked={selectedListIds.has(list.id)}
                onCheckedChange={() => onToggleList(list.id)}
                disabled={isLoading}
                aria-label={`Add to ${list.name}`}
              />
              {list.name}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
