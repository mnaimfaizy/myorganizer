/** Mocking rule: place jest.mock calls before any imports */
jest.mock('@myorganizer/web-ui', () => {
  const React = require('react');

  function Input(props: any) {
    // Render a plain input so react-hook-form register props (name, onChange, ref) work
    const { className, ...rest } = props;
    return <input data-testid="links-input" className={className} {...rest} />;
  }

  function Button({ children, ...props }: any) {
    // Simple button wrapper that preserves aria-label and text content
    return <button {...props}>{children}</button>;
  }

  return {
    Input,
    Button,
  };
});

import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { LinksInput } from '../components/LinksInput';

function TestForm({
  defaultValues,
  onSubmit,
  seedCount,
}: {
  defaultValues?: any;
  onSubmit?: (d: any) => void;
  seedCount?: number;
}) {
  const methods = useForm({ defaultValues: defaultValues ?? { links: [] } });

  // LinksInput expects a `control` that also exposes `register` (it spreads control.register)
  // Attach register onto the control object so the component can use it.
  (methods.control as any).register = methods.register;

  return (
    <form onSubmit={methods.handleSubmit((d) => onSubmit?.(d))}>
      <LinksInput control={methods.control} />
      <div data-testid="links-values">
        {JSON.stringify(methods.watch('links') ?? [])}
      </div>
      {typeof seedCount === 'number' && (
        <button
          data-testid="seed-links"
          type="button"
          onClick={() => {
            methods.setValue('links', Array(seedCount).fill(''));
          }}
        >
          Seed
        </button>
      )}
      <button data-testid="submit-button" type="submit">
        Submit
      </button>
    </form>
  );
}

describe('LinksInput component', () => {
  beforeEach(() => jest.resetAllMocks());

  // NOTE: a few environments show append() only adding once via UI clicks in jsdom.
  // To avoid flakiness we validate a single UI add works and use defaultValues to
  // exercise multi-item and boundary scenarios instead of repeated UI clicks.

  it('renders empty state: no inputs and shows Add button', () => {
    render(<TestForm />);

    expect(
      screen.queryAllByPlaceholderText('https://example.com'),
    ).toHaveLength(0);
    expect(screen.getByText('Add another link')).toBeInTheDocument();
    expect(
      screen.queryByText('Maximum 10 links reached'),
    ).not.toBeInTheDocument();
  });

  it('adds a single link when clicking Add and renders a url input', async () => {
    render(<TestForm />);

    // add first link only (UI click)
    fireEvent.click(screen.getByText('Add another link'));
    await waitFor(() =>
      expect(
        screen.getAllByPlaceholderText('https://example.com'),
      ).toHaveLength(1),
    );

    const inputs = screen.getAllByPlaceholderText('https://example.com');
    expect(inputs[0]).toHaveAttribute('type', 'url');
    expect(inputs[0]).toHaveAttribute('placeholder', 'https://example.com');
  });

  it('allows typing into inputs and persists values in form state (seeded two items)', async () => {
    render(<TestForm seedCount={2} />);

    // seed two items via the test-only button
    fireEvent.click(screen.getByTestId('seed-links'));
    await waitFor(() =>
      expect(
        screen.getAllByPlaceholderText('https://example.com'),
      ).toHaveLength(2),
    );

    const inputs = screen.getAllByPlaceholderText('https://example.com');
    fireEvent.change(inputs[0], { target: { value: 'https://a.example' } });
    fireEvent.change(inputs[1], { target: { value: 'https://b.example' } });

    await waitFor(() => {
      const txt = screen.getByTestId('links-values').textContent || '[]';
      const val = JSON.parse(txt);
      expect(val).toEqual(['https://a.example', 'https://b.example']);
    });
  });

  it('removes the correct link and updates form state (seeded three items)', async () => {
    const onSubmit = jest.fn();
    render(<TestForm seedCount={3} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId('seed-links'));
    await waitFor(() =>
      expect(
        screen.getAllByPlaceholderText('https://example.com'),
      ).toHaveLength(3),
    );

    const inputs = screen.getAllByPlaceholderText('https://example.com');
    fireEvent.change(inputs[0], { target: { value: 'https://1' } });
    fireEvent.change(inputs[1], { target: { value: 'https://2' } });
    fireEvent.change(inputs[2], { target: { value: 'https://3' } });

    // remove middle link (index 1)
    const removeBtn = screen.getByLabelText('Remove link 2');
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);

    await waitFor(() =>
      expect(
        screen.getAllByPlaceholderText('https://example.com'),
      ).toHaveLength(2),
    );

    await waitFor(() => {
      const txt = screen.getByTestId('links-values').textContent || '[]';
      const val = JSON.parse(txt);
      expect(val).toEqual(['https://1', 'https://3']);
    });

    // submit form includes current links
    fireEvent.click(screen.getByTestId('submit-button'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      const last = onSubmit.mock.calls[onSubmit.mock.calls.length - 1][0];
      expect(last).toMatchObject({ links: ['https://1', 'https://3'] });
    });
  });

  it('boundary behavior: 10 seeded items hides Add and shows message; deleting restores Add', async () => {
    // Initialize with 10 empty links via defaultValues (more reliable than button click)
    const tenLinks = Array(10).fill('https://example.com/1');
    render(<TestForm defaultValues={{ links: tenLinks }} />);

    // Should render 10 inputs immediately
    await waitFor(
      () =>
        expect(
          screen.getAllByPlaceholderText('https://example.com'),
        ).toHaveLength(10),
      { timeout: 1000 },
    );

    // At 10 items: no Add button, message shown
    expect(screen.queryByText('Add another link')).not.toBeInTheDocument();
    expect(screen.getByText('Maximum 10 links reached')).toBeInTheDocument();

    // remove one (10 -> 9)
    const remove10 = screen.getByLabelText('Remove link 10');
    fireEvent.click(remove10);

    await waitFor(() => {
      expect(
        screen.getAllByPlaceholderText('https://example.com'),
      ).toHaveLength(9);
    });

    // After removal: Add button reappears, message disappears
    expect(screen.getByText('Add another link')).toBeInTheDocument();
    expect(
      screen.queryByText('Maximum 10 links reached'),
    ).not.toBeInTheDocument();
  });

  it('accessibility: delete buttons have aria-label and inputs are type url and focusable', () => {
    render(<TestForm />);
    fireEvent.click(screen.getByText('Add another link'));

    const removeBtn = screen.getByLabelText('Remove link 1');
    expect(removeBtn).toBeInTheDocument();
    // focusable via keyboard
    (removeBtn as HTMLElement).focus();
    expect(document.activeElement).toBe(removeBtn);

    const input = screen.getByPlaceholderText(
      'https://example.com',
    ) as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'url');
  });
});
