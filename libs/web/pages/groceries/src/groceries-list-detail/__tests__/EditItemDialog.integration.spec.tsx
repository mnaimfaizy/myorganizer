/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react');

  // Simple Input that forwards all props to a real input so react-hook-form register works
  function Input(props: any) {
    const { className, ...rest } = props;
    return (
      <input
        data-testid={props['data-testid'] ?? undefined}
        className={className}
        {...rest}
      />
    );
  }

  function Button({ children, ...props }: any) {
    return <button {...props}>{children}</button>;
  }

  function Checkbox(props: any) {
    const { className, ...rest } = props;
    return <input type="checkbox" className={className} {...rest} />;
  }

  function Label({ children, htmlFor, ...props }: any) {
    return (
      <label htmlFor={htmlFor} {...props}>
        {children}
      </label>
    );
  }

  // Dialog mock: renders children only when open=true and exposes a backdrop that calls onOpenChange(false)
  function Dialog({ open, onOpenChange, children }: any) {
    if (!open) return null;
    return (
      <div data-testid="dialog-root">
        <div
          data-testid="dialog-backdrop"
          onClick={() => onOpenChange?.(false)}
        />
        {children}
      </div>
    );
  }

  const DialogContent = ({ children }: any) => <div>{children}</div>;
  const DialogHeader = ({ children }: any) => <div>{children}</div>;
  const DialogTitle = ({ children }: any) => <h2>{children}</h2>;
  const DialogDescription = ({ children }: any) => <p>{children}</p>;
  const DialogFooter = ({ children }: any) => <div>{children}</div>;

  // Minimal Select components to support CategorySelect's Controller usage
  function Select({ value, onValueChange, children, ...props }: any) {
    return (
      <select
        data-testid="rhf-select"
        value={value ?? ''}
        onChange={(e) => onValueChange?.(e.target.value)}
        {...props}
      >
        {children}
      </select>
    );
  }

  // SelectTrigger and SelectValue don't render anything in our mock - we're just using a plain select
  const SelectTrigger = () => null;
  const SelectValue = () => null;
  // SelectContent renders its children directly (they will be option elements)
  const SelectContent = ({ children }: any) => children;
  // SelectItem renders as option, but extract text content from children for valid HTML
  const SelectItem = ({ value, children }: any) => {
    // Extract text from nested spans/elements - handle both React elements and strings
    const getText = (node: any): string => {
      // Direct string
      if (typeof node === 'string') return node;
      // Number (like emojis rendered as numbers sometimes)
      if (typeof node === 'number') return String(node);
      // Array of children
      if (Array.isArray(node)) {
        return node.map((child) => getText(child)).join('');
      }
      // React element with props.children
      if (node && typeof node === 'object' && node.props) {
        if (node.props.children !== undefined) {
          return getText(node.props.children);
        }
      }
      return '';
    };
    const label = getText(children);
    return <option value={value}>{label}</option>;
  };

  return {
    Input,
    Button,
    Checkbox,
    Label,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
  };
});

// EditItemDialog uses a category icon grid (Controller-based) — no CategorySelect dropdown

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { EditItemDialog } from '../components/EditItemDialog';

function TestWrapper({ item, onSave, onClose, isLoading = false }: any) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button data-testid="open-dialog" onClick={() => setOpen(true)}>
        Open
      </button>
      <EditItemDialog
        item={item}
        isOpen={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        onSave={onSave}
        isLoading={isLoading}
      />
    </div>
  );
}

const sampleFullItem = {
  id: 'item-1',
  name: 'Organic Bananas',
  checked: true,
  category: 'produce',
  amount: '1 dozen',
  price: 3.49,
  notes: 'Get ripe ones',
  imageUrl: 'http://example.com/bananas.jpg',
  links: ['http://a.example', 'http://b.example'],
};

const sampleMinimalItem = {
  id: 'item-2',
  name: 'Water',
  checked: false,
  category: 'other',
  amount: undefined,
  price: undefined,
  notes: undefined,
  imageUrl: undefined,
  links: undefined,
};

describe('EditItemDialog integration', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('Dialog open/close behavior', () => {
    it('is hidden when not open and shows when opened', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      expect(screen.queryByText('Edit Item')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('open-dialog'));
      expect(await screen.findByText('Edit Item')).toBeInTheDocument();
    });

    it('clicking Cancel calls onClose and closes the dialog', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      expect(await screen.findByText('Edit Item')).toBeInTheDocument();

      // Cancel button
      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(screen.queryByText('Edit Item')).not.toBeInTheDocument();
    });

    it('clicking backdrop calls onClose and resets the form', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      expect(await screen.findByText('Edit Item')).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText('e.g., Organic Bananas');
      fireEvent.change(nameInput, { target: { value: 'Changed name' } });
      expect((nameInput as HTMLInputElement).value).toBe('Changed name');

      // click backdrop
      fireEvent.click(screen.getByTestId('dialog-backdrop'));
      await waitFor(() => expect(onClose).toHaveBeenCalled());

      // reopen to confirm reset
      fireEvent.click(screen.getByTestId('open-dialog'));
      const reopenedName = await screen.findByPlaceholderText(
        'e.g., Organic Bananas',
      );
      expect((reopenedName as HTMLInputElement).value).toBe(
        sampleFullItem.name,
      );
    });
  });

  describe('Form pre-filling and field editing', () => {
    it('pre-fills all fields from item and autofocuses name', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();

      // Render dialog open immediately so the form and controller initialize during mount
      render(
        <EditItemDialog
          item={sampleFullItem}
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
        />,
      );

      const nameInput = await screen.findByPlaceholderText(
        'e.g., Organic Bananas',
      );
      expect((nameInput as HTMLInputElement).value).toBe(sampleFullItem.name);

      const amount = screen.getByPlaceholderText('e.g., 2L, 1 dozen');
      expect((amount as HTMLInputElement).value).toBe(sampleFullItem.amount);

      const price = screen.getByPlaceholderText('0.00');
      expect((price as HTMLInputElement).value).toBe(
        String(sampleFullItem.price),
      );

      const notes = screen.getByPlaceholderText(
        'e.g., Get organic if available',
      );
      expect((notes as HTMLTextAreaElement).value).toBe(sampleFullItem.notes);

      const image = screen.getByPlaceholderText(
        'https://example.com/image.jpg',
      );
      expect((image as HTMLInputElement).value).toBe(sampleFullItem.imageUrl);

      // Links should be rendered by LinksInput
      await waitFor(() =>
        expect(
          screen.getAllByPlaceholderText('https://example.com'),
        ).toHaveLength(2),
      );

      // Category grid should show the Produce label for the item's category
      await waitFor(() => {
        expect(screen.getByText('Produce')).toBeInTheDocument();
      });

      // autofocus: name should be focused
      expect(document.activeElement).toBe(nameInput);
    });

    it('allows editing basic fields and checkbox', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));

      const nameInput = await screen.findByPlaceholderText(
        'e.g., Organic Bananas',
      );
      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      expect((nameInput as HTMLInputElement).value).toBe('New Name');

      // Category: click the Dairy icon grid button
      fireEvent.click(screen.getByText('Dairy'));
      // Verify category changed by checking the selected state (border-secondary class applied)
      await waitFor(() => {
        const dairyBtn = screen.getByText('Dairy').closest('button');
        expect(dairyBtn?.className).toContain('border-secondary');
      });

      const amount = screen.getByPlaceholderText('e.g., 2L, 1 dozen');
      fireEvent.change(amount, { target: { value: '2L' } });
      expect((amount as HTMLInputElement).value).toBe('2L');

      const price = screen.getByPlaceholderText('0.00');
      fireEvent.change(price, { target: { value: '4.50' } });
      expect((price as HTMLInputElement).value).toBe('4.50');

      const notes = screen.getByPlaceholderText(
        'e.g., Get organic if available',
      );
      fireEvent.change(notes, { target: { value: 'New notes' } });
      expect((notes as HTMLTextAreaElement).value).toBe('New notes');

      const image = screen.getByPlaceholderText(
        'https://example.com/image.jpg',
      );
      fireEvent.change(image, { target: { value: 'http://new.img' } });
      expect((image as HTMLInputElement).value).toBe('http://new.img');

      // Links: add one via UI and type
      fireEvent.click(screen.getByText('Add another link'));
      await waitFor(() =>
        expect(
          screen.getAllByPlaceholderText('https://example.com').length,
        ).toBeGreaterThanOrEqual(3),
      );
      const inputs = screen.getAllByPlaceholderText('https://example.com');
      fireEvent.change(inputs[2], { target: { value: 'http://new.link' } });
      expect((inputs[2] as HTMLInputElement).value).toBe('http://new.link');

      // Checkbox toggle
      const checkbox = screen.getByLabelText(
        'Mark as done',
      ) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('Validation', () => {
    it('shows name required error when name is empty', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const form = container.querySelector('form') as HTMLFormElement;
      const nameInput = screen.getByPlaceholderText('e.g., Organic Bananas');
      fireEvent.change(nameInput, { target: { value: '' } });

      fireEvent.submit(form);

      await waitFor(() =>
        expect(screen.getByText('Item name is required')).toBeInTheDocument(),
      );
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows price validation message for out-of-range values', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const form = container.querySelector('form') as HTMLFormElement;
      const price = screen.getByPlaceholderText('0.00');
      fireEvent.change(price, { target: { value: '100000' } });
      fireEvent.submit(form);
      await waitFor(() =>
        expect(
          screen.getByText('Price must be between 0 and 99,999'),
        ).toBeInTheDocument(),
      );
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows imageUrl validation error and prevents submit when links invalid', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const form = container.querySelector('form') as HTMLFormElement;
      const image = screen.getByPlaceholderText(
        'https://example.com/image.jpg',
      );
      fireEvent.change(image, { target: { value: 'not-a-url' } });

      // Make first link invalid
      const linkInputs = screen.getAllByPlaceholderText('https://example.com');
      fireEvent.change(linkInputs[0], { target: { value: 'invalid-link' } });

      fireEvent.submit(form);

      await waitFor(() =>
        expect(screen.getByText('Must be a valid URL')).toBeInTheDocument(),
      );
      // Links individual item errors are surfaced per-index; the dialog prevents submit but may not show an array-level message.
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows notes length validation', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const form = container.querySelector('form') as HTMLFormElement;
      const notes = screen.getByPlaceholderText(
        'e.g., Get organic if available',
      );
      const long = 'x'.repeat(1001);
      fireEvent.change(notes, { target: { value: long } });

      fireEvent.submit(form);

      await waitFor(() =>
        expect(
          screen.getByText('Notes must be 1000 characters or less'),
        ).toBeInTheDocument(),
      );
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Dirty-checking and submission', () => {
    it('no changes -> onSave receives only id', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      expect(onSave).toHaveBeenCalledWith({ id: sampleFullItem.id });
    });

    it('changing name only -> onSave receives only name + id', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const nameInput = screen.getByPlaceholderText('e.g., Organic Bananas');
      fireEvent.change(nameInput, { target: { value: 'Brand New' } });

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => expect(onSave).toHaveBeenCalled());
      expect(onSave).toHaveBeenCalledWith({
        id: sampleFullItem.id,
        name: 'Brand New',
      });
    });

    it('changing price -> onSave receives numeric price', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const price = screen.getByPlaceholderText('0.00');
      fireEvent.change(price, { target: { value: '4.50' } });

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => expect(onSave).toHaveBeenCalled());
      expect(onSave).toHaveBeenCalledWith({
        id: sampleFullItem.id,
        price: 4.5,
      });
    });

    it('clearing optional fields yields undefined in payload', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const amount = screen.getByPlaceholderText('e.g., 2L, 1 dozen');
      fireEvent.change(amount, { target: { value: '' } });

      const price = screen.getByPlaceholderText('0.00');
      fireEvent.change(price, { target: { value: '' } });

      const notes = screen.getByPlaceholderText(
        'e.g., Get organic if available',
      );
      fireEvent.change(notes, { target: { value: '' } });

      const image = screen.getByPlaceholderText(
        'https://example.com/image.jpg',
      );
      fireEvent.change(image, { target: { value: '' } });

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => expect(onSave).toHaveBeenCalled());
      const payload = onSave.mock.calls[0][0];
      expect(payload).toHaveProperty('amount', undefined);
      expect(payload).toHaveProperty('price', undefined);
      expect(payload).toHaveProperty('notes', undefined);
      expect(payload).toHaveProperty('imageUrl', undefined);
    });

    it('reverting a change removes it from payload', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const nameInput = screen.getByPlaceholderText('e.g., Organic Bananas');
      fireEvent.change(nameInput, { target: { value: 'Temp' } });
      fireEvent.change(nameInput, { target: { value: sampleFullItem.name } });

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => expect(onSave).toHaveBeenCalled());
      expect(onSave).toHaveBeenCalledWith({ id: sampleFullItem.id });
    });
  });

  describe('Loading and error flows', () => {
    it('disables fields and shows saving state when loading', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      render(
        <TestWrapper
          item={sampleFullItem}
          onSave={onSave}
          onClose={onClose}
          isLoading={true}
        />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const nameInput = screen.getByPlaceholderText(
        'e.g., Organic Bananas',
      ) as HTMLInputElement;
      expect(nameInput.disabled).toBe(true);

      const saveBtn = screen.getByText('Saving...');
      expect(saveBtn).toBeDisabled();

      fireEvent.click(saveBtn);
      expect(onSave).not.toHaveBeenCalled();
    });

    it('when onSave rejects dialog remains open and error is logged', async () => {
      const onSave = jest.fn().mockRejectedValue(new Error('fail'));
      const onClose = jest.fn();
      const consoleErr = jest
        .spyOn(console, 'error')
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        .mockImplementation(() => {});

      const { container } = render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      await waitFor(() => expect(onSave).toHaveBeenCalled());
      expect(consoleErr).toHaveBeenCalled();
      // dialog should still be open because onClose is only called after successful save
      expect(screen.getByText('Edit Item')).toBeInTheDocument();
      consoleErr.mockRestore();
    });
  });

  describe('Image preview', () => {
    it('shows image preview when imageUrl starts with http', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      render(
        <TestWrapper item={sampleFullItem} onSave={onSave} onClose={onClose} />,
      );

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const image = screen.getByPlaceholderText(
        'https://example.com/image.jpg',
      );
      fireEvent.change(image, {
        target: { value: 'http://preview.example/img.png' },
      });
      await waitFor(() =>
        expect(screen.getByAltText('Item preview')).toBeInTheDocument(),
      );
    });
  });

  describe('Edge cases', () => {
    it('renders sensible defaults when item is null', async () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();
      render(<TestWrapper item={null} onSave={onSave} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('open-dialog'));
      await screen.findByText('Edit Item');

      const nameInput = screen.getByPlaceholderText('e.g., Organic Bananas');
      expect((nameInput as HTMLInputElement).value).toBe('');

      // Category grid should exist and default to 'other' (Other button present)
      expect(screen.getByText('Other')).toBeInTheDocument();

      // links default to empty
      expect(
        screen.queryAllByPlaceholderText('https://example.com'),
      ).toHaveLength(0);
    });
  });
});
