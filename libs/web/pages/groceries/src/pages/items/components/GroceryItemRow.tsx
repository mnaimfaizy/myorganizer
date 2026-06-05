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
      className={`flex items-center px-md py-lg hover:bg-surface-container transition-colors group ${
        item.checked
          ? 'bg-surface-container-low opacity-60'
          : 'bg-surface-container-lowest'
      }`}
    >
      <div className="flex items-center gap-md grow">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => onToggleChecked(item.id)}
          className="h-5 w-5 rounded border-2 border-outline-variant accent-secondary cursor-pointer"
          aria-label={`Toggle ${item.name}`}
        />

        {/* Category emoji */}
        <span className="text-lg" aria-hidden="true">
          {categoryEmoji}
        </span>

        {/* Item details */}
        <div className="grow">
          <span
            className={`text-body-base font-body-medium transition-all block ${
              item.checked ? 'line-through text-text-muted' : 'text-on-surface'
            }`}
          >
            {item.name}
          </span>
          {/* Amount and price details */}
          {(item.amount || item.price !== undefined) && (
            <span
              className={`text-xs transition-all ${
                item.checked ? 'text-text-muted' : 'text-on-surface-variant'
              }`}
            >
              {item.amount && <span>{item.amount}</span>}
              {item.amount && item.price !== undefined && <span> • </span>}
              {item.price !== undefined && (
                <span>${item.price.toFixed(2)}</span>
              )}
            </span>
          )}
          {/* Notes preview */}
          {item.notes && (
            <div
              className={`text-xs italic transition-all mt-1 ${
                item.checked ? 'text-text-muted' : 'text-on-surface-variant'
              }`}
            >
              📝 {item.notes.substring(0, 50)}
              {item.notes.length > 50 ? '...' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons - show on hover or always visible */}
      <div className="flex items-center gap-sm opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item.id)}
          className="p-sm hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors"
          aria-label={`Edit ${item.name}`}
          type="button"
        >
          <Edit2 className="h-5 w-5" />
        </button>

        <button
          onClick={handleDelete}
          className={`p-sm rounded-lg transition-colors ${
            isDeleting
              ? 'bg-error/10 text-error'
              : 'hover:bg-error/10 text-on-surface-variant hover:text-error'
          }`}
          aria-label={
            isDeleting ? `Confirm delete ${item.name}` : `Delete ${item.name}`
          }
          title={isDeleting ? 'Click again to confirm' : 'Delete item'}
          type="button"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
