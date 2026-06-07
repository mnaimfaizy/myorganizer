/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react');

  const SelectContext = React.createContext<any>(null);

  function Select({ value, onValueChange, children }: any) {
    const [open, setOpen] = React.useState(false);
    const [items, setItems] = React.useState<Record<string, string>>({});

    const registerItem = React.useCallback((val: string, label: string) => {
      setItems((prev: Record<string, string>) => ({ ...prev, [val]: label }));
    }, []);

    return (
      <SelectContext.Provider
        value={{ value, onValueChange, open, setOpen, registerItem, items }}
      >
        <div data-testid="select-root">{children}</div>
      </SelectContext.Provider>
    );
  }

  function SelectTrigger({ children, ...props }: any) {
    const ctx = React.useContext(SelectContext);
    return (
      <button
        data-testid="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={ctx?.open ? 'true' : 'false'}
        onClick={() => ctx?.setOpen?.(!ctx.open)}
        onKeyDown={(e: any) => {
          if (e.key === 'Enter' || e.key === ' ') {
            ctx?.setOpen?.(!ctx.open);
          }
          props.onKeyDown?.(e);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }

  function SelectValue({ placeholder }: any) {
    const ctx = React.useContext(SelectContext);
    const label = ctx?.items?.[ctx?.value as string];
    return <span data-testid="select-value">{label ?? placeholder}</span>;
  }

  function SelectContent({ children, ...props }: any) {
    const ctx = React.useContext(SelectContext);
    if (!ctx?.open) return null;
    return (
      <div data-testid="select-content" role="listbox" {...props}>
        {children}
      </div>
    );
  }

  function SelectItem({ value, children, ...props }: any) {
    const ctx = React.useContext(SelectContext);
    const ref = React.useRef<any>(null);
    const registerItem = ctx?.registerItem;

    React.useEffect(() => {
      if (ref.current && typeof value !== 'undefined') {
        registerItem?.(value, ref.current.textContent ?? String(value));
      }
    }, [value, registerItem]);

    return (
      <button
        ref={ref}
        data-testid="select-item"
        role="option"
        data-value={value}
        tabIndex={0}
        onClick={() => {
          ctx.onValueChange?.(value);
          ctx.setOpen?.(false);
        }}
        onKeyDown={(e: any) => {
          if (e.key === 'Enter' || e.key === ' ') {
            ctx.onValueChange?.(value);
            ctx.setOpen?.(false);
          }
        }}
        {...props}
      >
        {children}
      </button>
    );
  }

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

import '@testing-library/jest-dom';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { CATEGORY_LABELS, getCategoryEmoji } from '../../constants/categories';
import { CategorySelect } from '../CategorySelect';

const EXPECTED_CATEGORY_KEYS = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'bakery',
  'frozen',
  'beverages',
  'snacks',
  'condiments',
  'household',
  'personal-care',
  'other',
] as const;

function TestForm({
  defaultValue,
  onSubmit,
}: {
  defaultValue?: string;
  onSubmit?: (data: any) => void;
}) {
  const { handleSubmit, control, watch } = useForm({
    defaultValues: { category: defaultValue },
  });

  return (
    <form onSubmit={handleSubmit((d) => onSubmit?.(d))}>
      <CategorySelect control={control} />
      <div data-testid="selected-value">{watch('category') ?? ''}</div>
      <button data-testid="submit-button" type="submit">
        Submit
      </button>
    </form>
  );
}

describe('CategorySelect component', () => {
  beforeEach(() => jest.resetAllMocks());

  it('renders without crashing and shows placeholder', () => {
    render(<TestForm />);
    expect(screen.getByTestId('select-value')).toHaveTextContent(
      'Select a category',
    );
  });

  it('opens dropdown and renders all 12 categories with emoji and label', () => {
    render(<TestForm />);

    const trigger = screen.getByTestId('select-trigger');
    fireEvent.click(trigger);

    const content = screen.getByTestId('select-content');
    expect(content).toBeInTheDocument();

    const items = screen.getAllByTestId('select-item');
    expect(items).toHaveLength(12);

    for (const cat of EXPECTED_CATEGORY_KEYS) {
      const label = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS];
      const emoji = getCategoryEmoji(cat as any);

      expect(within(content).getByText(label)).toBeInTheDocument();
      expect(within(content).getByText(emoji)).toBeInTheDocument();

      const labelEl = within(content).getByText(label);
      const outer = labelEl.parentElement as HTMLElement | null;
      expect(outer).toBeTruthy();
      expect(outer?.className).toContain('gap-2');
    }
  });

  it('clicking an item updates the form value and trigger display, and selection can change', async () => {
    render(<TestForm />);

    fireEvent.click(screen.getByTestId('select-trigger'));
    const dairyBtn = screen
      .getAllByTestId('select-item')
      .find((b) => b.getAttribute('data-value') === 'dairy');
    expect(dairyBtn).toBeTruthy();
    fireEvent.click(dairyBtn!);

    await waitFor(() =>
      expect(screen.getByTestId('select-value')).toHaveTextContent('Dairy'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('selected-value')).toHaveTextContent('dairy'),
    );

    fireEvent.click(screen.getByTestId('select-trigger'));
    const bakeryBtn = screen
      .getAllByTestId('select-item')
      .find((b) => b.getAttribute('data-value') === 'bakery');
    expect(bakeryBtn).toBeTruthy();
    fireEvent.click(bakeryBtn!);

    await waitFor(() =>
      expect(screen.getByTestId('select-value')).toHaveTextContent('Bakery'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('selected-value')).toHaveTextContent('bakery'),
    );
  });

  it('integrates with react-hook-form: selected value is submitted', async () => {
    const onSubmit = jest.fn();
    render(<TestForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId('select-trigger'));
    const snacksBtn = screen
      .getAllByTestId('select-item')
      .find((b) => b.getAttribute('data-value') === 'snacks');
    fireEvent.click(snacksBtn!);

    await waitFor(() =>
      expect(screen.getByTestId('selected-value')).toHaveTextContent('snacks'),
    );

    fireEvent.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const lastCall = onSubmit.mock.calls[onSubmit.mock.calls.length - 1][0];
      expect(lastCall).toMatchObject({ category: 'snacks' });
    });
  });

  it('renders with an initial value from control and shows emoji in options', () => {
    render(<TestForm defaultValue="meat" />);
    fireEvent.click(screen.getByTestId('select-trigger'));
    expect(screen.getByTestId('select-value')).toHaveTextContent('Meat');

    const selectedItem = screen
      .getAllByTestId('select-item')
      .find((b) => b.getAttribute('data-value') === 'meat');
    expect(selectedItem).toBeTruthy();
    expect(
      within(selectedItem as HTMLElement).getByText(
        getCategoryEmoji('meat' as any),
      ),
    ).toBeTruthy();
  });

  it('is keyboard accessible: can focus trigger and select option via Enter', async () => {
    render(<TestForm />);
    const trigger = screen.getByTestId('select-trigger');
    (trigger as HTMLElement).focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.getByTestId('select-content')).toBeInTheDocument(),
    );

    const firstItem = screen.getAllByTestId('select-item')[0];
    (firstItem as HTMLElement).focus();
    fireEvent.keyDown(firstItem, { key: 'Enter' });

    const expectedValue = firstItem.getAttribute('data-value');
    await waitFor(() =>
      expect(screen.getByTestId('selected-value')).toHaveTextContent(
        expectedValue ?? '',
      ),
    );
  });

  it('exposes proper ARIA attributes for accessibility', () => {
    render(<TestForm />);
    const trigger = screen.getByTestId('select-trigger');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const content = screen.getByTestId('select-content');
    expect(content).toHaveAttribute('role', 'listbox');

    const options = screen.getAllByTestId('select-item');
    for (const opt of options) {
      expect(opt).toHaveAttribute('role', 'option');
    }
  });
});
