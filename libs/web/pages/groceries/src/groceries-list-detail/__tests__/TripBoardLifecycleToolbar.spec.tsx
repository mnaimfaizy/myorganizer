/** Mocking rule: place jest.mock calls before any imports. */
jest.mock('@myorganizer/web-ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('lucide-react', () => ({
  Plus: () => <span data-testid="plus-icon" />,
  ListPlus: () => <span data-testid="list-plus-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
}));

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { TripBoardLifecycleToolbar } from '../components/TripBoardLifecycleToolbar';

describe('TripBoardLifecycleToolbar', () => {
  const baseProps = {
    checkedCount: 2,
    onAddItem: jest.fn(),
    onUncheckAll: jest.fn(),
    onRemoveChecked: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Add Item, Uncheck All, and Remove Checked with the count', () => {
    render(<TripBoardLifecycleToolbar {...baseProps} />);

    expect(
      screen.getByRole('button', { name: 'Add Item' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Uncheck All' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove Checked (2)' }),
    ).toBeInTheDocument();
  });

  it('does not render Add From Catalog when onAddExisting is omitted', () => {
    render(<TripBoardLifecycleToolbar {...baseProps} />);

    expect(
      screen.queryByRole('button', { name: 'Add From Catalog' }),
    ).not.toBeInTheDocument();
  });

  it('renders Add From Catalog only when onAddExisting is provided', () => {
    render(
      <TripBoardLifecycleToolbar {...baseProps} onAddExisting={jest.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: 'Add From Catalog' }),
    ).toBeInTheDocument();
  });
});
