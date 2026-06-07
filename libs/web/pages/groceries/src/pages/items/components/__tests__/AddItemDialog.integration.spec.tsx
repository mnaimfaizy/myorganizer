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

  // Minimal Select components to be safe in the environment
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

  const SelectTrigger = () => null;
  const SelectValue = () => null;
  const SelectContent = ({ children }: any) => children;
  const SelectItem = ({ value, children }: any) => {
    const getText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map((c) => getText(c)).join('');
      if (node && typeof node === 'object' && node.props) {
        if (node.props.children !== undefined)
          return getText(node.props.children);
      }
      return '';
    };
    const label = getText(children);
    return <option value={value}>{label}</option>;
  };

  // Simple classnames joiner used by AddItemDialog
  const cn = (...args: any[]) => args.filter(Boolean).join(' ');

  return {
    Input,
    Button,
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
    cn,
  };
});

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { AddItemDialog } from '../AddItemDialog';

function TestWrapper({ onAdd, onClose, isLoading = false }: any) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button data-testid="open-dialog" onClick={() => setOpen(true)}>
        Open
      </button>
      <AddItemDialog
        isOpen={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        onAdd={onAdd}
        isLoading={isLoading}
      />
    </div>
  );
}

describe('AddItemDialog integration', () => {
  beforeEach(() => jest.resetAllMocks());

  it('is hidden when isOpen=false and shows when opened', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<TestWrapper onAdd={onAdd} onClose={onClose} />);

    expect(screen.queryByText('Add New Item')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-dialog'));
    expect(await screen.findByText('Add New Item')).toBeInTheDocument();
  });

  it('renders when isOpen=true and shows name placeholder', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    render(<AddItemDialog isOpen={true} onClose={jest.fn()} onAdd={onAdd} />);

    expect(await screen.findByText('Add New Item')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. Organic Almond Milk'),
    ).toBeInTheDocument();
  });

  it('Cancel -> onClose + form reset', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<TestWrapper onAdd={onAdd} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('open-dialog'));
    const nameInput = await screen.findByPlaceholderText(
      'e.g. Organic Almond Milk',
    );
    fireEvent.change(nameInput, { target: { value: 'Temp Name' } });
    expect((nameInput as HTMLInputElement).value).toBe('Temp Name');

    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    // reopen and confirm reset
    fireEvent.click(screen.getByTestId('open-dialog'));
    const reopened = await screen.findByPlaceholderText(
      'e.g. Organic Almond Milk',
    );
    expect((reopened as HTMLInputElement).value).toBe('');
  });

  it('backdrop -> onClose + form reset', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<TestWrapper onAdd={onAdd} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('open-dialog'));
    const nameInput = await screen.findByPlaceholderText(
      'e.g. Organic Almond Milk',
    );
    fireEvent.change(nameInput, { target: { value: 'Changed name' } });
    expect((nameInput as HTMLInputElement).value).toBe('Changed name');

    // click backdrop
    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    // reopen -> confirm reset
    fireEvent.click(screen.getByTestId('open-dialog'));
    const reopened = await screen.findByPlaceholderText(
      'e.g. Organic Almond Milk',
    );
    expect((reopened as HTMLInputElement).value).toBe('');
  });

  it('empty name shows required error and prevents submit', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { container } = render(
      <TestWrapper onAdd={onAdd} onClose={onClose} />,
    );

    fireEvent.click(screen.getByTestId('open-dialog'));
    await screen.findByText('Add New Item');

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText('Item name is required')).toBeInTheDocument(),
    );
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('price out-of-range blocks submit', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { container } = render(
      <TestWrapper onAdd={onAdd} onClose={onClose} />,
    );

    fireEvent.click(screen.getByTestId('open-dialog'));
    await screen.findByText('Add New Item');

    const name = screen.getByPlaceholderText('e.g. Organic Almond Milk');
    fireEvent.change(name, { target: { value: 'Milk' } });

    const price = screen.getByPlaceholderText('0.00');
    fireEvent.change(price, { target: { value: '100000' } });

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(
        screen.getByText('Price must be between 0 and 99,999'),
      ).toBeInTheDocument(),
    );
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('invalid imageUrl blocks submit', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { container } = render(
      <TestWrapper onAdd={onAdd} onClose={onClose} />,
    );

    fireEvent.click(screen.getByTestId('open-dialog'));
    await screen.findByText('Add New Item');

    const name = screen.getByPlaceholderText('e.g. Organic Almond Milk');
    fireEvent.change(name, { target: { value: 'Milk' } });

    const image = screen.getByPlaceholderText('https://example.com/image.jpg');
    fireEvent.change(image, { target: { value: 'not-a-url' } });

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() =>
      expect(screen.getByText('Must be a valid URL')).toBeInTheDocument(),
    );
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('minimal submit succeeds and calls onAdd with expected payload', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { container } = render(
      <TestWrapper onAdd={onAdd} onClose={onClose} />,
    );

    fireEvent.click(screen.getByTestId('open-dialog'));
    await screen.findByText('Add New Item');

    const name = screen.getByPlaceholderText('e.g. Organic Almond Milk');
    fireEvent.change(name, { target: { value: 'Milk' } });

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const payload = onAdd.mock.calls[0][0];
    expect(payload).toEqual({
      name: 'Milk',
      category: 'other',
      amount: undefined,
      price: undefined,
      notes: undefined,
      imageUrl: undefined,
      links: undefined,
    });

    // onClose should have been called and form should reset on reopen
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // reopen to confirm reset
    fireEvent.click(screen.getByTestId('open-dialog'));
    const reopened = await screen.findByPlaceholderText(
      'e.g. Organic Almond Milk',
    );
    expect((reopened as HTMLInputElement).value).toBe('');
  });

  it('full submit with all fields calls onAdd with parsed values', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { container } = render(
      <TestWrapper onAdd={onAdd} onClose={onClose} />,
    );

    fireEvent.click(screen.getByTestId('open-dialog'));
    await screen.findByText('Add New Item');

    // name
    const name = screen.getByPlaceholderText('e.g. Organic Almond Milk');
    fireEvent.change(name, { target: { value: 'Full Milk' } });

    // select category (click the label text)
    const produceBtn = screen.getByText(/Produce/);
    fireEvent.click(produceBtn);

    // amount
    const amount = screen.getByPlaceholderText('e.g. 2, 500g');
    fireEvent.change(amount, { target: { value: '2L' } });

    // price
    const price = screen.getByPlaceholderText('0.00');
    fireEvent.change(price, { target: { value: '4.50' } });

    // notes
    const notes = screen.getByPlaceholderText(
      'Add specific brands, sizes or dietary requirements...',
    );
    fireEvent.change(notes, { target: { value: 'Some notes' } });

    // image
    const image = screen.getByPlaceholderText('https://example.com/image.jpg');
    fireEvent.change(image, {
      target: { value: 'http://img.example/pic.jpg' },
    });

    // links: add one (jsdom can be flaky for multiple appends)
    fireEvent.click(screen.getByText('Add another link'));
    await waitFor(() =>
      expect(
        screen.getAllByPlaceholderText('https://example.com').length,
      ).toBeGreaterThanOrEqual(1),
    );

    const linkInputs = screen.getAllByPlaceholderText('https://example.com');
    fireEvent.change(linkInputs[0], { target: { value: 'http://a.link' } });

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    const payload = onAdd.mock.calls[0][0];
    expect(payload).toEqual({
      name: 'Full Milk',
      category: 'produce',
      amount: '2L',
      price: 4.5,
      notes: 'Some notes',
      imageUrl: 'http://img.example/pic.jpg',
      links: ['http://a.link'],
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('category button selection updates selected class', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    render(<AddItemDialog isOpen={true} onClose={jest.fn()} onAdd={onAdd} />);

    const produceBtn = await screen.findByText(/Produce/);
    fireEvent.click(produceBtn);
    // selected button should include border-secondary class
    const btn = produceBtn.closest('button') as HTMLButtonElement;
    expect(btn.className).toContain('border-secondary');
  });

  it('isLoading disables inputs and buttons', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<TestWrapper onAdd={onAdd} onClose={onClose} isLoading={true} />);

    fireEvent.click(screen.getByTestId('open-dialog'));
    await screen.findByText('Add New Item');

    const name = screen.getByPlaceholderText(
      'e.g. Organic Almond Milk',
    ) as HTMLInputElement;
    expect(name.disabled).toBe(true);

    const cancel = screen.getByText('Cancel') as HTMLButtonElement;
    const addBtn = screen.getByText('Add to List') as HTMLButtonElement;
    expect(cancel).toBeDisabled();
    expect(addBtn).toBeDisabled();
  });

  it('Add to List is disabled when form invalid', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    render(<AddItemDialog isOpen={true} onClose={jest.fn()} onAdd={onAdd} />);

    await screen.findByText('Add New Item');
    const addBtn = screen.getByText('Add to List') as HTMLButtonElement;
    expect(addBtn).toBeDisabled();
  });

  it('image preview appears when imageUrl starts with http', async () => {
    const onAdd = jest.fn().mockResolvedValue(undefined);
    render(<AddItemDialog isOpen={true} onClose={jest.fn()} onAdd={onAdd} />);

    await screen.findByText('Add New Item');
    const image = screen.getByPlaceholderText('https://example.com/image.jpg');
    fireEvent.change(image, {
      target: { value: 'http://preview.example/img.png' },
    });

    await waitFor(() =>
      expect(screen.getByAltText('Item preview')).toBeInTheDocument(),
    );
  });
});
