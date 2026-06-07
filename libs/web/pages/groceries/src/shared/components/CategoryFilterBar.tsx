'use client';

import { GroceryCategoryType, GroceryItem } from '@myorganizer/core';
import { cn } from '@myorganizer/web-ui';
import { memo, useMemo } from 'react';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getCategoryEmoji,
} from '../constants/categories';

interface CategoryFilterBarProps {
  items: GroceryItem[];
  activeCategory: GroceryCategoryType | 'all';
  onCategoryChange: (category: GroceryCategoryType | 'all') => void;
}

/**
 * Horizontal scrollable category filter bar
 * Shows only categories that have items in the current list
 * Keyboard accessible: Tab to navigate, Enter/Space to select
 */
function CategoryFilterBarComponent({
  items,
  activeCategory,
  onCategoryChange,
}: CategoryFilterBarProps) {
  // Get unique categories in use, sorted by CATEGORY_ORDER
  const categoriesInUse = useMemo(() => {
    const categoriesSet = new Set<GroceryCategoryType>(
      items.map((item) => (item.category as GroceryCategoryType) || 'other'),
    );

    // Sort by CATEGORY_ORDER
    return CATEGORY_ORDER.filter((cat) => categoriesSet.has(cat));
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    category: GroceryCategoryType | 'all',
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCategoryChange(category);
    }
  };

  return (
    <div
      className="flex gap-2 overflow-x-auto py-md px-1"
      role="tablist"
      aria-label="Filter items by category"
    >
      {/* "All" button */}
      <button
        onClick={() => onCategoryChange('all')}
        onKeyDown={(e) => handleKeyDown(e, 'all')}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-secondary',
          activeCategory === 'all'
            ? 'bg-secondary text-on-secondary'
            : 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
        )}
        role="tab"
        aria-selected={activeCategory === 'all'}
        aria-label="Show all items"
      >
        All
      </button>

      {/* Category buttons */}
      {categoriesInUse.map((category) => {
        const label = CATEGORY_LABELS[category];
        const emoji = getCategoryEmoji(category);

        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            onKeyDown={(e) => handleKeyDown(e, category)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-secondary',
              activeCategory === category
                ? 'bg-secondary text-on-secondary'
                : 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80',
            )}
            role="tab"
            aria-selected={activeCategory === category}
            aria-label={`Filter by ${label}`}
          >
            <span aria-hidden="true">{emoji}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const CategoryFilterBar = memo(CategoryFilterBarComponent);
