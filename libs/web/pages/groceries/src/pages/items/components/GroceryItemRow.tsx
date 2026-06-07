'use client';

import type { GroceryItem } from '@myorganizer/core';
import { Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getCategoryEmoji } from '../../../shared/constants/categories';

interface GroceryItemRowProps {
  item: GroceryItem;
  onToggleChecked: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Individual grocery item row component
 * Renders a single item with checkbox, name, and action buttons
 */
export function GroceryItemRow({
  item,
  onToggleChecked,
  onEdit,
  onDelete,
}: GroceryItemRowProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = () => {
    if (isDeleting) {
      onDelete(item.id);
      setIsDeleting(false);
    } else {
      setIsDeleting(true);
      // Auto-reset after 3 seconds
      setTimeout(() => setIsDeleting(false), 3000);
    }
  };

  const categoryEmoji = getCategoryEmoji(item.category);

  return (
    <div
      data-testid={`item-row-${item.name}`}
      className={`flex items-center px-4 py-3 hover:bg-muted/40 transition-colors group cursor-pointer ${
        item.checked ? 'bg-muted/20' : 'bg-card'
      }`}
    >
      <div className="flex items-center gap-3 grow min-w-0">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => onToggleChecked(item.id)}
          className="h-5 w-5 shrink-0 rounded border-2 border-border accent-secondary cursor-pointer"
          aria-label={`Toggle ${item.name}`}
        />

        {/* Emoji + details */}
        <div className="flex items-center gap-2 min-w-0 grow">
          <span className="text-lg shrink-0 leading-none" aria-hidden="true">
            {categoryEmoji}
          </span>

          <div className="flex flex-col min-w-0">
            {/* Item name */}
            <span
              className={`text-sm font-semibold leading-snug transition-all ${
                item.checked
                  ? 'line-through text-muted-foreground'
                  : 'text-foreground'
              }`}
            >
              {item.name}
            </span>

            {/* Amount • Price */}
            {(item.amount || item.price !== undefined) && (
              <div
                className={`flex items-center gap-1 mt-0.5 transition-all ${
                  item.checked ? 'opacity-50' : ''
                }`}
              >
                {item.amount && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {item.amount}
                  </span>
                )}
                {item.amount && item.price !== undefined && (
                  <span className="text-[11px] text-muted-foreground select-none">
                    •
                  </span>
                )}
                {item.price !== undefined && (
                  <span className="text-[11px] font-medium text-muted-foreground">
                    ${item.price.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            {/* Notes preview */}
            {item.notes && (
              <div
                className={`text-[11px] italic mt-0.5 transition-all ${
                  item.checked
                    ? 'text-muted-foreground/50'
                    : 'text-muted-foreground'
                }`}
              >
                📝 {item.notes.substring(0, 50)}
                {item.notes.length > 50 ? '...' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons — visible on row hover */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item.id)}
          className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Edit ${item.name}`}
          type="button"
        >
          <Edit2 className="h-4 w-4" />
        </button>

        <button
          onClick={handleDelete}
          className={`p-1.5 rounded-lg transition-colors ${
            isDeleting
              ? 'bg-destructive/10 text-destructive'
              : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
          }`}
          aria-label={
            isDeleting ? `Confirm delete ${item.name}` : `Delete ${item.name}`
          }
          title={isDeleting ? 'Click again to confirm' : 'Delete item'}
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
