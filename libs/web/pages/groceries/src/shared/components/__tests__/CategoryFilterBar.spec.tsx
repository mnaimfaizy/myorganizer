/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-ui', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import type { GroceryCategoryType, GroceryItem } from '@myorganizer/core';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getCategoryEmoji,
} from '../../constants/categories';
import { CategoryFilterBar } from '../CategoryFilterBar';

const now = new Date().toISOString();
let idCounter = 1;
function mkItem(
  overrides: Partial<GroceryItem> & { category?: GroceryCategoryType },
) {
  const id = `item-${idCounter++}`;
  return {
    id,
    name: overrides.name ?? `Item ${id}`,
    category: overrides.category ?? 'other',
    checked: overrides.checked ?? false,
    createdAt: now,
    updatedAt: now,
  } as unknown as GroceryItem;
}

describe('CategoryFilterBar', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('Rendering Empty State', () => {
    it('returns null when items array is empty', () => {
      const onChange = jest.fn();
      const { container } = render(
        <CategoryFilterBar
          items={[]}
          activeCategory="all"
          onCategoryChange={onChange}
        />,
      );

      expect(container.firstChild).toBeNull();
      expect(screen.queryByText('All')).not.toBeInTheDocument();
    });
  });

  describe('Rendering with Single Category', () => {
    it('shows All button and single category with emoji + label, All highlighted when active', () => {
      const item = mkItem({ category: 'produce', name: 'Lettuce' });
      const onChange = jest.fn();

      render(
        <CategoryFilterBar
          items={[item]}
          activeCategory="all"
          onCategoryChange={onChange}
        />,
      );

      const allBtn = screen.getByRole('button', { name: /All/i });
      expect(allBtn).toBeInTheDocument();
      expect(allBtn).toHaveClass('bg-secondary');
      expect(allBtn).toHaveClass('text-on-secondary');

      const label = CATEGORY_LABELS.produce;
      const emoji = getCategoryEmoji('produce');

      const labelEl = screen.getByText(label);
      expect(labelEl).toBeInTheDocument();
      const categoryBtn = labelEl.closest('button');
      expect(categoryBtn).toBeInTheDocument();
      expect(categoryBtn).toHaveTextContent(emoji);
      expect(categoryBtn).toHaveClass('bg-secondary-container');
    });
  });

  describe('Rendering with Multiple Categories and Sorting', () => {
    it('shows All + only categories in use, sorted by CATEGORY_ORDER, each shown once', () => {
      const items = [
        mkItem({ category: 'bakery', name: 'Bread' }),
        mkItem({ category: 'produce', name: 'Lettuce' }),
        mkItem({ category: 'dairy', name: 'Milk' }),
        mkItem({ category: 'bakery', name: 'Rolls' }),
      ];

      const { container } = render(
        <CategoryFilterBar
          items={items}
          activeCategory="all"
          onCategoryChange={jest.fn()}
        />,
      );

      // container should be horizontally scrollable
      expect(container.firstChild).toHaveClass('overflow-x-auto');

      const buttons = screen.getAllByRole('button');
      // First button is All
      expect(buttons[0]).toHaveTextContent('All');

      // Expected categories in order (filtered by CATEGORY_ORDER)
      const expectedOrder = CATEGORY_ORDER.filter((c) =>
        ['produce', 'dairy', 'bakery'].includes(c),
      );
      expect(expectedOrder).toEqual(['produce', 'dairy', 'bakery']);

      // Buttons after the first correspond to categories in expectedOrder
      for (let i = 0; i < expectedOrder.length; i++) {
        const cat = expectedOrder[i] as GroceryCategoryType;
        const btn = buttons[i + 1];
        expect(btn).toBeTruthy();
        expect(btn).toHaveTextContent(CATEGORY_LABELS[cat]);
        expect(btn).toHaveTextContent(getCategoryEmoji(cat));

        // each label appears exactly once
        const matches = screen.getAllByText(CATEGORY_LABELS[cat]);
        expect(matches).toHaveLength(1);
      }

      // Category not present in items should not render
      expect(screen.queryByText(CATEGORY_LABELS.meat)).not.toBeInTheDocument();
    });
  });

  describe('Active Category Styling and Accessibility', () => {
    it('highlights the active category button and sets aria-pressed appropriately', () => {
      const items = [
        mkItem({ category: 'produce' }),
        mkItem({ category: 'dairy' }),
        mkItem({ category: 'bakery' }),
      ];

      render(
        <CategoryFilterBar
          items={items}
          activeCategory="dairy"
          onCategoryChange={jest.fn()}
        />,
      );

      const allBtn = screen.getByRole('button', { name: /All/i });
      // All should not be highlighted when a category is active
      expect(allBtn).toHaveClass('bg-secondary-container');
      expect(allBtn).not.toHaveClass('bg-secondary');

      const dairyLabel = CATEGORY_LABELS.dairy;
      const dairyLabelEl = screen.getByText(dairyLabel);
      const dairyBtn = dairyLabelEl.closest('button') as HTMLElement;
      expect(dairyBtn).toBeTruthy();
      expect(dairyBtn).toHaveClass('bg-secondary');
      expect(dairyBtn).toHaveAttribute('aria-pressed', 'true');

      // Other category buttons should not be pressed
      const produceBtn = screen
        .getByText(CATEGORY_LABELS.produce)
        .closest('button') as HTMLElement;
      const bakeryBtn = screen
        .getByText(CATEGORY_LABELS.bakery)
        .closest('button') as HTMLElement;
      expect(produceBtn).toHaveAttribute('aria-pressed', 'false');
      expect(bakeryBtn).toHaveAttribute('aria-pressed', 'false');

      // Only one highlighted button
      const allButtons = screen.getAllByRole('button');
      const highlighted = allButtons.filter((b) =>
        (b as HTMLElement).classList.contains('bg-secondary'),
      );
      expect(highlighted).toHaveLength(1);
    });
  });

  describe('User Interaction - Button Clicks', () => {
    it('clicking All calls onCategoryChange with "all"', () => {
      const items = [mkItem({ category: 'produce' })];
      const onChange = jest.fn();
      render(
        <CategoryFilterBar
          items={items}
          activeCategory="produce"
          onCategoryChange={onChange}
        />,
      );

      const allBtn = screen.getByRole('button', { name: /All/i });
      fireEvent.click(allBtn);
      expect(onChange).toHaveBeenCalledWith('all');
    });

    it('clicking a category button calls onCategoryChange with that category and works repeatedly', () => {
      const items = [
        mkItem({ category: 'produce' }),
        mkItem({ category: 'dairy' }),
      ];
      const onChange = jest.fn();
      render(
        <CategoryFilterBar
          items={items}
          activeCategory="all"
          onCategoryChange={onChange}
        />,
      );

      const produceBtn = screen
        .getByText(CATEGORY_LABELS.produce)
        .closest('button') as HTMLElement;
      const dairyBtn = screen
        .getByText(CATEGORY_LABELS.dairy)
        .closest('button') as HTMLElement;

      fireEvent.click(produceBtn);
      fireEvent.click(dairyBtn);
      fireEvent.click(dairyBtn);

      expect(onChange).toHaveBeenCalledTimes(3);
      expect(onChange.mock.calls[0][0]).toBe('produce');
      expect(onChange.mock.calls[1][0]).toBe('dairy');
      expect(onChange.mock.calls[2][0]).toBe('dairy');
    });
  });

  describe('Computed Categories Logic & Edge Cases', () => {
    it('only shows categories that exist in items and updates when items change', () => {
      const a = mkItem({ category: 'produce' });
      const b = mkItem({ category: 'dairy' });

      const { rerender } = render(
        <CategoryFilterBar
          items={[a, b]}
          activeCategory="all"
          onCategoryChange={jest.fn()}
        />,
      );

      expect(screen.getByText(CATEGORY_LABELS.produce)).toBeInTheDocument();
      expect(screen.getByText(CATEGORY_LABELS.dairy)).toBeInTheDocument();
      expect(screen.queryByText(CATEGORY_LABELS.meat)).not.toBeInTheDocument();

      // Add meat item and verify it appears in order
      const c = mkItem({ category: 'meat' });
      rerender(
        <CategoryFilterBar
          items={[a, b, c]}
          activeCategory="all"
          onCategoryChange={jest.fn()}
        />,
      );
      expect(screen.getByText(CATEGORY_LABELS.meat)).toBeInTheDocument();

      // Remove dairy
      rerender(
        <CategoryFilterBar
          items={[a, c]}
          activeCategory="all"
          onCategoryChange={jest.fn()}
        />,
      );
      expect(screen.queryByText(CATEGORY_LABELS.dairy)).not.toBeInTheDocument();
    });

    it('handles single item with category other and multiple items of same category', () => {
      const onlyOther = mkItem({ category: 'other' });
      render(
        <CategoryFilterBar
          items={[onlyOther]}
          activeCategory="all"
          onCategoryChange={jest.fn()}
        />,
      );

      expect(screen.getByText(CATEGORY_LABELS.other)).toBeInTheDocument();

      // multiple same category
      const a = mkItem({ category: 'snacks' });
      const b = mkItem({ category: 'snacks' });
      const { rerender } = render(
        <CategoryFilterBar
          items={[a, b]}
          activeCategory="all"
          onCategoryChange={jest.fn()}
        />,
      );
      expect(screen.getAllByText(CATEGORY_LABELS.snacks)).toHaveLength(1);
    });
  });

  describe('Large category set', () => {
    it('renders many categories in CATEGORY_ORDER and shows All first', () => {
      const cats = [
        'produce',
        'dairy',
        'meat',
        'seafood',
        'bakery',
        'frozen',
      ] as GroceryCategoryType[];

      const items = cats.map((c) => mkItem({ category: c }));

      const { container } = render(
        <CategoryFilterBar
          items={items}
          activeCategory="all"
          onCategoryChange={jest.fn()}
        />,
      );

      // All + categories
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(cats.length + 1);

      // Ensure order matches CATEGORY_ORDER
      const expected = CATEGORY_ORDER.filter((c) => cats.includes(c));
      for (let i = 0; i < expected.length; i++) {
        const cat = expected[i] as GroceryCategoryType;
        const btn = buttons[i + 1];
        expect(btn).toHaveTextContent(CATEGORY_LABELS[cat]);
        expect(btn).toHaveTextContent(getCategoryEmoji(cat));
      }

      // container scrollable
      expect(container.firstChild).toHaveClass('overflow-x-auto');
    });
  });

  describe('Accessibility basics', () => {
    it('category buttons have aria-pressed and All button is keyboard-focusable', () => {
      const items = [
        mkItem({ category: 'produce' }),
        mkItem({ category: 'dairy' }),
      ];
      render(
        <CategoryFilterBar
          items={items}
          activeCategory="produce"
          onCategoryChange={jest.fn()}
        />,
      );

      const produceBtn = screen
        .getByText(CATEGORY_LABELS.produce)
        .closest('button') as HTMLElement;
      const dairyBtn = screen
        .getByText(CATEGORY_LABELS.dairy)
        .closest('button') as HTMLElement;

      expect(produceBtn).toHaveAttribute('aria-pressed', 'true');
      expect(dairyBtn).toHaveAttribute('aria-pressed', 'false');

      const allBtn = screen.getByRole('button', {
        name: /All/i,
      }) as HTMLElement;
      allBtn.focus();
      expect(document.activeElement).toBe(allBtn);
    });
  });
});
