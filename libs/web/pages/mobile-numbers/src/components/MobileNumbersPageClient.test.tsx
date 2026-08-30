jest.mock('@myorganizer/web-ui', () => ({
  useToast: jest.fn(),
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children, variant }: any) => (
    <span data-testid={`badge-${variant}`}>{children}</span>
  ),
  Input: ({ ...props }: any) => <input {...props} />,
  ConfirmDeleteDialog: ({
    open,
    onOpenChange,
    title,
    description,
    onConfirm,
  }: any) => {
    if (!open) return null;
    return (
      <div data-testid="confirm-delete-dialog" role="dialog">
        <h2>{title}</h2>
        <p data-testid="delete-description">{description}</p>
        <button
          data-testid="delete-cancel-btn"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
        <button data-testid="delete-confirm-btn" onClick={() => onConfirm()}>
          Delete
        </button>
      </div>
    );
  },
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  Form: ({ children }: any) => <form>{children}</form>,
  FormField: ({ children }: any) => <div>{children}</div>,
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormLabel: ({ children }: any) => <label>{children}</label>,
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormMessage: ({ children }: any) => <span>{children}</span>,
  Label: ({ htmlFor, children }: any) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Select: ({ value, onValueChange, children }: any) => {
    // Extract options from SelectContent if present, otherwise use children directly
    let selectContent: any = null;
    const childArray = Array.isArray(children) ? children : [children];
    for (let i = 0; i < childArray.length; i++) {
      const child = childArray[i];
      if (child && child.type && child.type.name === 'SelectContent') {
        selectContent = child;
        break;
      }
    }

    const options = selectContent ? selectContent.props.children : children;

    return (
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid="select-element"
      >
        {options}
      </select>
    );
  },
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  Checkbox: ({ checked, onChange, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => {
        if (onCheckedChange) {
          onCheckedChange(e.target.checked);
        } else if (onChange) {
          onChange(e);
        }
      }}
      {...props}
    />
  ),
}));

let mockHandleLoadFn: jest.Mock | null = null;
let mockHandleSaveFn: jest.Mock | null = null;

const createMockHandle = (
  loadDataMock?: jest.Mock,
  saveDataMock?: jest.Mock,
): any => {
  const load = loadDataMock || jest.fn().mockResolvedValue([]);
  const save = saveDataMock || jest.fn().mockResolvedValue(undefined);
  return {
    isUnlocked: true,
    loadDecryptedData: load,
    saveEncryptedData: save,
  };
};

jest.mock('@myorganizer/web-vault-ui', () => ({
  // Constant: these suites never converge, so the revision never moves.
  // Reloading on a moved revision is covered where it is the subject.
  useLocalVaultRevision: () => 0,
  VaultGate: ({
    children,
  }: {
    children: (props: { handle: any }) => unknown;
  }) => {
    const loadFn = mockHandleLoadFn || jest.fn().mockResolvedValue([]);
    const saveFn = mockHandleSaveFn || jest.fn().mockResolvedValue(undefined);
    const handle = createMockHandle(loadFn, saveFn);
    return children({ handle }) as React.ReactElement;
  },
}));

jest.mock('@myorganizer/web-vault', () => ({
  normalizeMobileNumbers: jest.fn((data) => ({
    value: data || [],
    changed: false,
  })),
}));

jest.mock('@myorganizer/core', () => {
  const actual = jest.requireActual('@myorganizer/core');
  return {
    ...actual,
  };
});

/* eslint-disable import/first -- jest.mock() calls must precede module imports per Jest requirement */
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import type { MobileNumberRecord } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import { MobileNumbersPageClient } from './MobileNumbersPageClient';
/* eslint-enable import/first */

const mockUseToast = useToast as jest.Mock;

const mockToast = jest.fn();

function makeMobileNumberRecord(
  id: string,
  overrides?: Partial<MobileNumberRecord>,
): MobileNumberRecord {
  return {
    id,
    label: 'Test Mobile',
    countryCode: '+1',
    phoneNumber: '5551234567',
    usageLocations: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MobileNumbersPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleLoadFn = null;
    mockHandleSaveFn = null;
    mockUseToast.mockReturnValue({ toast: mockToast });
  });

  describe('Mobile number list and deletion', () => {
    it('should not render delete dialog before Delete button is clicked', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId('confirm-delete-dialog'),
      ).not.toBeInTheDocument();
    });

    it('should open confirm delete dialog when Delete button clicked', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });
    });

    it('should show mobile number label in delete confirm dialog title', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      expect(screen.getByText('Delete "Home"?')).toBeInTheDocument();
    });

    it('should show no usage location wording for mobile number with 0 locations', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
        usageLocations: [],
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const description = screen.getByTestId('delete-description');
      expect(description).toHaveTextContent(
        'The mobile number will be permanently removed.',
      );
      expect(description).not.toHaveTextContent('usage location');
    });

    it('should show singular wording for mobile number with exactly 1 usage location', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
        usageLocations: [
          {
            id: 'loc1',
            organisationName: 'DHHS',
            organisationType: 'government',
            updateMethod: 'online',
            priority: 'normal',
            changed: false,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const description = screen.getByTestId('delete-description');
      expect(description).toHaveTextContent('1 usage location');
      expect(description).not.toHaveTextContent('locations');
    });

    it('should show plural wording for mobile number with multiple usage locations', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
        usageLocations: [
          {
            id: 'loc1',
            organisationName: 'DHHS',
            organisationType: 'government',
            updateMethod: 'online',
            priority: 'normal',
            changed: false,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'loc2',
            organisationName: 'Medicare',
            organisationType: 'government',
            updateMethod: 'online',
            priority: 'normal',
            changed: false,
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const description = screen.getByTestId('delete-description');
      expect(description).toHaveTextContent('2 usage locations');
    });

    it('should not call saveEncryptedData when Delete button clicked (only on confirm)', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      expect(mockHandleSaveFn).not.toHaveBeenCalled();
    });

    it('should persist deletion when confirm delete clicked', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Verify mobile number is removed from payload
      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value).toHaveLength(0);
    });

    it('should close delete dialog after confirm', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId('confirm-delete-dialog'),
        ).not.toBeInTheDocument();
      });
    });

    it('should not call saveEncryptedData when cancel delete clicked', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('delete-cancel-btn');
      fireEvent.click(cancelButton);

      expect(mockHandleSaveFn).not.toHaveBeenCalled();
    });

    it('should close delete dialog when cancel clicked', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('delete-cancel-btn');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId('confirm-delete-dialog'),
        ).not.toBeInTheDocument();
      });
    });

    it('should keep mobile number in list after cancel delete', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('delete-cancel-btn');
      fireEvent.click(cancelButton);

      // Mobile number should still be in the list
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('should show destructive toast and keep dialog open if save fails', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
      });
      mockHandleLoadFn = jest.fn().mockResolvedValue([mobileNumber]);
      mockHandleSaveFn = jest.fn().mockRejectedValue(new Error('Save failed'));

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: new RegExp(`Delete Home`, 'i'),
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to save',
            variant: 'destructive',
          }),
        );
      });

      // Dialog should still be open for retry
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
    });
  });

  describe('Add mobile number dialog', () => {
    it('should not render add dialog before Add button is clicked', async () => {
      mockHandleLoadFn = jest.fn().mockResolvedValue([]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Your mobile numbers')).toBeInTheDocument();
      });

      expect(
        screen.queryByText(
          'Add a private mobile number to your encrypted vault.',
        ),
      ).not.toBeInTheDocument();
    });

    it('should open add dialog when Add Mobile Number button clicked', async () => {
      mockHandleLoadFn = jest.fn().mockResolvedValue([]);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Your mobile numbers')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', {
        name: /add mobile number/i,
      });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Add a private mobile number to your encrypted vault.',
          ),
        ).toBeInTheDocument();
      });
    });

    it('should persist new mobile number and close dialog when form is submitted', async () => {
      mockHandleLoadFn = jest.fn().mockResolvedValue([]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<MobileNumbersPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Your mobile numbers')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', {
        name: /add mobile number/i,
      });
      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            'Add a private mobile number to your encrypted vault.',
          ),
        ).toBeInTheDocument();
      });

      // Fill in label field
      const labelInput = screen.getByPlaceholderText(
        'Personal',
      ) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(labelInput, { target: { value: 'Personal' } });
        fireEvent.blur(labelInput);
      });

      // Fill in country code select
      const countryCodeSelect = screen.getByTestId('select-element');
      await act(async () => {
        fireEvent.change(countryCodeSelect, { target: { value: '+1' } });
      });

      // Fill in phone number field
      const phoneInput = screen.getByPlaceholderText(
        '555 123 4567',
      ) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '5551234567' } });
        fireEvent.blur(phoneInput);
      });

      // Find the form within the dialog and submit it
      const dialogContent = screen.getByTestId('dialog-content');
      const form = dialogContent.querySelector('form');
      if (!form) throw new Error('Form not found');

      await act(async () => {
        fireEvent.submit(form);
      });

      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Verify the new mobile number was persisted with correct values
      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value).toHaveLength(1);
      expect(lastCall[0].value[0]).toEqual(
        expect.objectContaining({
          label: 'Personal',
          countryCode: '+1',
          phoneNumber: '5551234567',
        }),
      );

      // Dialog should close
      await waitFor(() => {
        expect(
          screen.queryByText(
            'Add a private mobile number to your encrypted vault.',
          ),
        ).not.toBeInTheDocument();
      });
    });
  });
});
