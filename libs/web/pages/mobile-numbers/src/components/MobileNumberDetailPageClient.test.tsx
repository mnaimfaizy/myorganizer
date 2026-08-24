jest.mock('@myorganizer/web-ui', () => {
  const RHF = jest.requireActual('react-hook-form');
  return {
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
    Table: ({ children }: any) => <table>{children}</table>,
    TableHeader: ({ children }: any) => <thead>{children}</thead>,
    TableBody: ({ children }: any) => <tbody>{children}</tbody>,
    TableHead: ({ children }: any) => <th>{children}</th>,
    TableCell: ({ children, colSpan, ...props }: any) => (
      <td colSpan={colSpan} {...props}>
        {children}
      </td>
    ),
    TableRow: ({ children }: any) => <tr>{children}</tr>,
    Dialog: ({ children, open }: any) =>
      open ? <div data-testid="dialog-root">{children}</div> : null,
    DialogContent: ({ children, showCloseButton }: any) => (
      <div data-testid="dialog-content">
        {children}
        {showCloseButton === false && <div data-testid="close-disabled" />}
      </div>
    ),
    DialogHeader: ({ children }: any) => <div>{children}</div>,
    DialogTitle: ({ children }: any) => <h2>{children}</h2>,
    DialogDescription: ({ children }: any) => <p>{children}</p>,
    DialogFooter: ({ children }: any) => (
      <div data-testid="dialog-footer">{children}</div>
    ),
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
    Form: RHF.FormProvider,
    FormField: ({ control, name, render }: any) => (
      <RHF.Controller control={control} name={name} render={render} />
    ),
    FormItem: ({ children }: any) => <div>{children}</div>,
    FormLabel: ({ htmlFor, children }: any) => (
      <label htmlFor={htmlFor}>{children}</label>
    ),
    FormControl: ({ children }: any) => <>{children}</>,
    FormMessage: ({ children }: any) => (
      <span data-testid="form-message">{children}</span>
    ),
    Input: ({ ...props }: any) => <input {...props} />,
    Label: ({ htmlFor, children }: any) => (
      <label htmlFor={htmlFor}>{children}</label>
    ),
    Combobox: ({ id, value, onValueChange, options, placeholder }: any) => (
      <select
        id={id}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid={`combobox-${id}`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        {...props}
      />
    ),
  };
});

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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import type {
  MobileNumberRecord,
  UsageLocationRecord,
} from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import { loadDecryptedData, saveEncryptedData } from '@myorganizer/web-vault';
import { MobileNumberDetailPageClient } from './MobileNumberDetailPageClient';
/* eslint-enable import/first */

const mockUseToast = useToast as jest.Mock;
const mockLoadDecryptedData = loadDecryptedData as jest.Mock;
const mockSaveEncryptedData = saveEncryptedData as jest.Mock;

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

function makeUsageLocation(
  id: string,
  overrides?: Partial<UsageLocationRecord>,
): UsageLocationRecord {
  return {
    id,
    organisationName: 'Test Org',
    organisationType: 'government',
    updateMethod: 'online',
    priority: 'normal',
    changed: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MobileNumberDetailPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockLoadDecryptedData.mockResolvedValue([]);
    mockSaveEncryptedData.mockResolvedValue(undefined);
  });

  describe('Mobile number detail loading and resolution', () => {
    it('should render mobile number details when id is found in vault', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Work Phone',
        phoneNumber: '5559876543',
      });
      const location = makeUsageLocation('loc1', {
        organisationName: 'Company',
      });
      mobileNumber.usageLocations = [location];
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Work Phone')).toBeInTheDocument();
        expect(screen.getByText('Company')).toBeInTheDocument();
      });
    });

    it('should render not-found state when mobile number id is absent from vault', async () => {
      const otherMobileNumber = makeMobileNumberRecord('mob2', {
        label: 'Other',
      });
      mockLoadDecryptedData.mockResolvedValue([otherMobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(
          screen.getByText('Mobile number not found.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Mobile number edit dialog', () => {
    it('should not render edit dialog before Edit button is clicked', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      expect(screen.queryByText('Edit mobile number')).not.toBeInTheDocument();
    });

    it('should open edit dialog when Edit button clicked', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit mobile number')).toBeInTheDocument();
      });
    });

    it('should update and persist mobile number when edit form is submitted', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
        phoneNumber: '5551234567',
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit mobile number')).toBeInTheDocument();
      });

      // Change label field
      const labelInput = screen.getByDisplayValue('Home') as HTMLInputElement;
      fireEvent.change(labelInput, { target: { value: 'Updated Home' } });
      fireEvent.blur(labelInput);

      const saveButton = screen.getByRole('button', { name: /save changes/i });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });

      // Verify payload has updated label
      const calls = (mockSaveEncryptedData as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value).toContainEqual(
        expect.objectContaining({ label: 'Updated Home' }),
      );

      // Dialog should close
      await waitFor(() => {
        expect(
          screen.queryByText('Edit mobile number'),
        ).not.toBeInTheDocument();
      });
    });

    it('should never call router.push when saving mobile number edit', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', { label: 'Home' });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit mobile number')).toBeInTheDocument();
      });

      const labelInput = screen.getByDisplayValue('Home') as HTMLInputElement;
      fireEvent.change(labelInput, { target: { value: 'Office' } });

      const saveButton = screen.getByRole('button', { name: /save changes/i });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });
    });
  });

  describe('Usage locations - add', () => {
    it('should show empty state and no dialog on initial render', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
        usageLocations: [],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      expect(screen.queryByText('Add usage location')).not.toBeInTheDocument();
    });

    it('should open dialog in add mode when Add Location clicked', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
        usageLocations: [],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button', {
        name: /add location/i,
      });
      fireEvent.click(addButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Add usage location')).toBeInTheDocument();
      });
    });

    it('should persist new usage location and close dialog', async () => {
      const mobileNumber = makeMobileNumberRecord('mob1', {
        label: 'Home',
        usageLocations: [],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
      });

      const addButtons = screen.getAllByRole('button', {
        name: /add location/i,
      });
      fireEvent.click(addButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Add usage location')).toBeInTheDocument();
      });

      // Fill in org name
      const orgInput = screen.getByPlaceholderText(
        'ATO / Comm Bank',
      ) as HTMLInputElement;
      fireEvent.change(orgInput, {
        target: { value: 'Bureau of Internal Revenue' },
      });
      fireEvent.blur(orgInput);

      const dialogFooter = screen.getByTestId('dialog-footer');
      const submitButton = within(dialogFooter).getByRole('button', {
        name: /add location/i,
      });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });

      // Verify the new location was persisted
      const calls = (mockSaveEncryptedData as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const savedMobileNumber = lastCall[0].value[0];
      expect(savedMobileNumber.usageLocations).toHaveLength(1);
      expect(savedMobileNumber.usageLocations[0]).toEqual(
        expect.objectContaining({
          organisationName: 'Bureau of Internal Revenue',
        }),
      );

      // Dialog should close
      await waitFor(() => {
        expect(
          screen.queryByText('Add usage location'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Usage locations - edit', () => {
    it('should open dialog in edit mode with existing org name pre-filled', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const editButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent?.includes('Edit') && btn.closest('tr'));
      if (!editButton) throw new Error('Edit button not found');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit usage location')).toBeInTheDocument();
        expect(screen.getByDisplayValue('DHHS')).toBeInTheDocument();
      });
    });

    it('should show Save changes button in edit mode', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const editButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent?.includes('Edit') && btn.closest('tr'));
      if (!editButton) throw new Error('Edit button not found');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /save changes/i }),
        ).toBeInTheDocument();
      });
    });

    it('should persist edited usage location', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const editButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent?.includes('Edit') && btn.closest('tr'));
      if (!editButton) throw new Error('Edit button not found');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit usage location')).toBeInTheDocument();
      });

      const orgInput = screen.getByDisplayValue('DHHS') as HTMLInputElement;
      fireEvent.change(orgInput, { target: { value: 'Medicare' } });
      fireEvent.blur(orgInput);

      const saveButton = screen.getByRole('button', { name: /save changes/i });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });

      // Verify the location was updated
      const calls = (mockSaveEncryptedData as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const savedMobileNumber = lastCall[0].value[0];
      expect(savedMobileNumber.usageLocations[0].organisationName).toBe(
        'Medicare',
      );
      expect(savedMobileNumber.usageLocations).toHaveLength(1);
    });

    it('should never call router.push when editing usage location', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const editButton = screen
        .getAllByRole('button')
        .find((btn) => btn.textContent?.includes('Edit') && btn.closest('tr'));
      if (!editButton) throw new Error('Edit button not found');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit usage location')).toBeInTheDocument();
      });

      const orgInput = screen.getByDisplayValue('DHHS') as HTMLInputElement;
      fireEvent.change(orgInput, { target: { value: 'Medicare' } });

      const saveButton = screen.getByRole('button', { name: /save changes/i });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });
    });
  });

  describe('Usage locations - delete', () => {
    it('should open confirm delete dialog when Delete clicked', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.textContent?.includes('Delete') && btn.closest('tr'),
        );
      if (!deleteButton) throw new Error('Delete button not found');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });
    });

    it('should not call saveEncryptedData when Delete clicked', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.textContent?.includes('Delete') && btn.closest('tr'),
        );
      if (!deleteButton) throw new Error('Delete button not found');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      expect(mockSaveEncryptedData).not.toHaveBeenCalled();
    });

    it('should remove location and persist when confirm delete clicked', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.textContent?.includes('Delete') && btn.closest('tr'),
        );
      if (!deleteButton) throw new Error('Delete button not found');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });

      // Verify location is removed
      const calls = (mockSaveEncryptedData as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const savedMobileNumber = lastCall[0].value[0];
      expect(savedMobileNumber.usageLocations).toHaveLength(0);
    });

    it('should not call saveEncryptedData when cancel delete clicked', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.textContent?.includes('Delete') && btn.closest('tr'),
        );
      if (!deleteButton) throw new Error('Delete button not found');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('delete-cancel-btn');
      fireEvent.click(cancelButton);

      expect(mockSaveEncryptedData).not.toHaveBeenCalled();
    });

    it('should keep location visible after cancel delete', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.textContent?.includes('Delete') && btn.closest('tr'),
        );
      if (!deleteButton) throw new Error('Delete button not found');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('delete-cancel-btn');
      fireEvent.click(cancelButton);

      // Location should still be visible
      expect(screen.getByText('DHHS')).toBeInTheDocument();
    });

    it('should keep delete dialog open if save fails, allowing retry', async () => {
      const location = makeUsageLocation('loc1', {
        organisationName: 'DHHS',
      });
      const mobileNumber = makeMobileNumberRecord('mob1', {
        usageLocations: [location],
      });
      mockLoadDecryptedData.mockResolvedValue([mobileNumber]);
      mockSaveEncryptedData.mockRejectedValue(new Error('Save failed'));

      render(<MobileNumberDetailPageClient params={{ id: 'mob1' }} />);

      await waitFor(() => {
        expect(screen.getByText('DHHS')).toBeInTheDocument();
      });

      const deleteButton = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.textContent?.includes('Delete') && btn.closest('tr'),
        );
      if (!deleteButton) throw new Error('Delete button not found');
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
