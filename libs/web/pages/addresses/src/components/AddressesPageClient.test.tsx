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
  Select: ({ value, onValueChange, children }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      data-testid="select-element"
    >
      {children}
    </select>
  ),
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

jest.mock('./AddAddressCard', () => ({
  AddAddressCard: ({ open, onOpenChange, onAdd }: any) => (
    <div data-testid="add-address-card">
      {open && (
        <div data-testid="add-address-dialog">
          <button
            data-testid="submit-add-address"
            onClick={() => {
              onAdd({
                label: 'New Address',
                propertyNumber: '',
                street: '123 New St',
                suburb: 'New City',
                state: 'NC',
                zipCode: '12345',
                countryCode: 'AU',
              });
            }}
          >
            Add
          </button>
        </div>
      )}
      <button data-testid="open-add-address" onClick={() => onOpenChange(true)}>
        Add Address
      </button>
    </div>
  ),
}));

jest.mock('@myorganizer/web-vault-ui', () => ({
  VaultGate: ({
    children,
  }: {
    children: (props: { masterKeyBytes: Uint8Array }) => unknown;
  }) => children({ masterKeyBytes: new Uint8Array(32) }) as React.ReactElement,
}));

jest.mock('@myorganizer/web-vault', () => ({
  loadDecryptedData: jest.fn(),
  saveEncryptedData: jest.fn(),
  normalizeAddresses: jest.fn((data) => ({
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { AddressRecord } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import { loadDecryptedData, saveEncryptedData } from '@myorganizer/web-vault';
import { AddressesPageClient } from './AddressesPageClient';
/* eslint-enable import/first */

const mockUseToast = useToast as jest.Mock;
const mockLoadDecryptedData = loadDecryptedData as jest.Mock;
const mockSaveEncryptedData = saveEncryptedData as jest.Mock;

const mockToast = jest.fn();

function makeAddressRecord(
  id: string,
  overrides?: Partial<AddressRecord>,
): AddressRecord {
  return {
    id,
    label: 'Test Address',
    street: '123 Main St',
    suburb: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    country: 'United States',
    status: 'current',
    usageLocations: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('AddressesPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockLoadDecryptedData.mockResolvedValue([]);
    mockSaveEncryptedData.mockResolvedValue(undefined);
  });

  describe('Address list and deletion', () => {
    it('should not render delete dialog before Delete button is clicked', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId('confirm-delete-dialog'),
      ).not.toBeInTheDocument();
    });

    it('should open confirm delete dialog when Delete button clicked', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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

    it('should show address name in delete confirm dialog title', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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

    it('should not call saveEncryptedData when Delete button clicked (only on confirm)', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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

      expect(mockSaveEncryptedData).not.toHaveBeenCalled();
    });

    it('should show no usage location wording for address with 0 locations', async () => {
      const address = makeAddressRecord('addr1', {
        label: 'Home',
        usageLocations: [],
      });
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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
        'The address will be permanently removed.',
      );
      expect(description).not.toHaveTextContent('usage location');
    });

    it('should show singular wording for address with exactly 1 usage location', async () => {
      const address = makeAddressRecord('addr1', {
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
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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

    it('should show plural wording for address with multiple usage locations', async () => {
      const address = makeAddressRecord('addr1', {
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
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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

    it('should persist deletion when confirm delete clicked', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<AddressesPageClient />);

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
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });

      // Verify address is removed from payload
      const calls = (mockSaveEncryptedData as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value).toHaveLength(0);
    });

    it('should close delete dialog after confirm', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<AddressesPageClient />);

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
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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

      expect(mockSaveEncryptedData).not.toHaveBeenCalled();
    });

    it('should close delete dialog when cancel clicked', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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

    it('should keep address in list after cancel delete', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);

      render(<AddressesPageClient />);

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

      // Address should still be in the list
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('should show destructive toast and keep dialog open if save fails', async () => {
      const address = makeAddressRecord('addr1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([address]);
      mockSaveEncryptedData.mockRejectedValue(new Error('Save failed'));

      render(<AddressesPageClient />);

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
});
