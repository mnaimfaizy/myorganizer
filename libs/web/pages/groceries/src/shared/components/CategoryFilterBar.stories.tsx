import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import type { GroceryCategoryType, GroceryItem } from '@myorganizer/core';
import { CategoryFilterBar } from './CategoryFilterBar';

const meta: Meta<typeof CategoryFilterBar> = {
  component: CategoryFilterBar,
  title: 'Components/CategoryFilterBar',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CategoryFilterBar>;

/**
 * Mock grocery items across multiple categories.
 * CategoryFilterBar filters which categories to show based on items present.
 */
const mockItems: GroceryItem[] = [
  {
    id: '1',
    name: 'Lettuce',
    category: 'produce',
    checked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Milk',
    category: 'dairy',
    checked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Chicken Breast',
    category: 'meat',
    checked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'Salmon',
    category: 'seafood',
    checked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: 'Bread',
    category: 'bakery',
    checked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '6',
    name: 'Ice Cream',
    category: 'frozen',
    checked: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

/**
 * AllSelected story: "All" pill is active (brand color), all category pills are inactive.
 * Visually proves that the selected state (brand background) is applied correctly to "All".
 * Visual regression test for the inverted-affordance bug: selected pill must have *darker*, not fainter, styling.
 */
export const AllSelected: Story = {
  render: function Render() {
    const [activeCategory, setActiveCategory] = useState<
      GroceryCategoryType | 'all'
    >('all');
    return (
      <CategoryFilterBar
        items={mockItems}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
    );
  },
};

/**
 * SpecificCategorySelected story: "Produce" category is active (brand color), all others inactive.
 * Visually proves the selected state differs from inactive state.
 * This catches the affordance regression: selected tile must have darker brand styling.
 */
export const SpecificCategorySelected: Story = {
  render: function Render() {
    const [activeCategory, setActiveCategory] = useState<
      GroceryCategoryType | 'all'
    >('produce');
    return (
      <CategoryFilterBar
        items={mockItems}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
    );
  },
};

/**
 * FirstCategorySelected story: First category (Produce) is selected.
 * Catches off-by-one errors where the first position might not get the correct styling.
 * In a snapshot, the first pill should clearly show brand background vs. muted neighbors.
 */
export const FirstCategorySelected: Story = {
  render: function Render() {
    const [activeCategory, setActiveCategory] = useState<
      GroceryCategoryType | 'all'
    >('produce');
    return (
      <CategoryFilterBar
        items={mockItems}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
    );
  },
};

/**
 * LastCategorySelected story: Last category (Frozen) is selected.
 * Catches off-by-one errors where the last position might not get correct styling.
 * In a snapshot, the last pill should show brand background distinct from muted neighbors.
 */
export const LastCategorySelected: Story = {
  render: function Render() {
    const [activeCategory, setActiveCategory] = useState<
      GroceryCategoryType | 'all'
    >('frozen');
    return (
      <CategoryFilterBar
        items={mockItems}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
    );
  },
};
