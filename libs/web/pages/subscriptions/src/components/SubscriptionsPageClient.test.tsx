jest.mock('@myorganizer/web-ui', () => ({
  useToast: jest.fn(),
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Table: ({ children }: any) => <table>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
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
  Input: ({ ...props }: any) => <input {...props} />,
  Label: ({ htmlFor, children }: any) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Select: ({ value, onValueChange, children }: any) => (
    <div data-testid="select-root">
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid="select-element"
      >
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
  DatePicker: ({ value, onChange }: any) => (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="date-picker"
    />
  ),
}));

jest.mock('./SubscriptionsListCard', () => ({
  SubscriptionsListCard: ({
    subscriptions,
    onEditSubscription,
    onRequestDelete,
  }: any) => (
    <div data-testid="subscriptions-list">
      {subscriptions.map((sub: any) => (
        <div key={sub.id} data-testid={`subscription-row-${sub.id}`}>
          <span data-testid={`sub-name-${sub.id}`}>{sub.name}</span>
          <button
            onClick={() => onEditSubscription(sub.id)}
            data-testid={`edit-${sub.id}`}
          >
            Edit
          </button>
          <button
            onClick={() => onRequestDelete(sub.id)}
            data-testid={`delete-${sub.id}`}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./SubscriptionsTotalsCard', () => ({
  SubscriptionsTotalsCard: (props: any) => (
    <div
      data-testid="totals-card"
      data-totals={JSON.stringify(props.nativeSubtotals)}
    />
  ),
}));

let mockHandleLoadFn: jest.Mock | null = null;
let mockHandleSaveFn: jest.Mock | null = null;

jest.mock('@myorganizer/web-vault-ui', () => ({
  // Constant: these suites never converge, so the revision never moves.
  // Reloading on a moved revision is covered where it is the subject.
  useLocalVaultRevision: () => 0,
  VaultGate: ({
    children,
  }: {
    children: (props: { handle: VaultHandle }) => unknown;
  }) => {
    const loadFn = mockHandleLoadFn || jest.fn().mockResolvedValue([]);
    const saveFn = mockHandleSaveFn || jest.fn().mockResolvedValue(undefined);
    const handle = createMockHandle(loadFn, saveFn);
    return children({ handle }) as React.ReactElement;
  },
}));

jest.mock('@myorganizer/web-vault', () => {
  const actual = jest.requireActual('@myorganizer/web-vault');
  return {
    ...actual,
    normalizeSubscriptions: jest.fn((data) => {
      let records: any[] = [];
      if (Array.isArray(data)) {
        records = data;
      } else if (data && typeof data === 'object' && 'records' in data) {
        records = Array.isArray(data.records) ? data.records : [];
      }
      return {
        value: records,
        changed: false,
      };
    }),
  };
});

jest.mock('@myorganizer/core', () => {
  const actual = jest.requireActual('@myorganizer/core');
  return {
    ...actual,
    getAccountSettings: jest.fn(() => ({
      preferredCurrency: 'AUD',
    })),
    subscribeAccountSettings: jest.fn(() => jest.fn()),
  };
});

/* eslint-disable import/first -- jest.mock() calls must precede module imports per Jest requirement */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  type SubscriptionRecord,
  SubscriptionStatusEnum,
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionTierEnum,
} from '@myorganizer/vault-core';
import { useToast } from '@myorganizer/web-ui';
import {
  normalizeSubscriptions,
  type VaultHandle,
} from '@myorganizer/web-vault';
import { SubscriptionsPageClient } from './SubscriptionsPageClient';
/* eslint-enable import/first */

const mockUseToast = useToast as jest.Mock;
const mockNormalizeSubscriptions = normalizeSubscriptions as jest.Mock;

const mockToast = jest.fn();

const createMockHandle = (
  loadDataMock?: jest.Mock,
  saveDataMock?: jest.Mock,
): VaultHandle => {
  const load = loadDataMock || jest.fn().mockResolvedValue([]);
  const save = saveDataMock || jest.fn().mockResolvedValue(undefined);
  return {
    isUnlocked: true,
    loadDecryptedData: load,
    saveEncryptedData: save,
  } as unknown as VaultHandle;
};

function makeSubscriptionRecord(
  id: string,
  overrides?: Partial<SubscriptionRecord>,
): SubscriptionRecord {
  return {
    id,
    name: 'Test Subscription',
    status: SubscriptionStatusEnum.Active,
    billingCycle: SubscriptionBillingCycleEnum.Monthly,
    amount: 9.99,
    currency: 'AUD',
    paymentMethod: SubscriptionPaymentMethodEnum.CreditCard,
    renewalType: SubscriptionRenewalTypeEnum.AutoRenew,
    tier: SubscriptionTierEnum.Basic,
    startDate: '2024-01-01T00:00:00.000Z',
    nextBillingDate: '2024-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('SubscriptionsPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleLoadFn = null;
    mockHandleSaveFn = null;
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockNormalizeSubscriptions.mockImplementation((data) => {
      let records: any[] = [];
      if (Array.isArray(data)) {
        records = data;
      } else if (data && typeof data === 'object' && 'records' in data) {
        records = Array.isArray(data.records) ? data.records : [];
      }
      return {
        value: records,
        changed: false,
      };
    });
  });

  describe('Initial render', () => {
    it('should not render add or edit dialog on first render before vault loads', () => {
      mockHandleLoadFn = jest.fn(
        () =>
          new Promise(() => {
            // Never resolve
          }),
      );

      render(<SubscriptionsPageClient />);

      // Dialog should not be visible (via test ID for the open dialog)
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('should not render add or edit dialog after vault loads with empty data', async () => {
      mockHandleLoadFn = jest.fn().mockResolvedValue([]);

      render(<SubscriptionsPageClient />);

      // Wait for vault load to complete
      await waitFor(() => {
        expect(mockHandleLoadFn).toHaveBeenCalled();
      });

      // Dialog should not be visible initially
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });
  });

  describe('Add subscription', () => {
    it('should open add dialog when Add Subscription button clicked', async () => {
      mockHandleLoadFn = jest.fn().mockResolvedValue([]);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(mockHandleLoadFn).toHaveBeenCalled();
      });

      // Dialog is closed initially
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();

      const addButton = screen.getByRole('button', {
        name: 'Add Subscription',
      });
      fireEvent.click(addButton);

      // Dialog should open
      await waitFor(() => {
        expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      });
    });

    it('should create new subscription when add form is filled and submitted', async () => {
      mockHandleLoadFn = jest.fn().mockResolvedValue([]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(mockHandleLoadFn).toHaveBeenCalled();
      });

      // Open add dialog
      const addButton = screen.getByRole('button', {
        name: 'Add Subscription',
      });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      });

      // Fill in the name field
      const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Disney Plus' } });

      // Trigger validation by blurring the input
      fireEvent.blur(nameInput);

      // Submit the form - wait for the form submit button to be enabled
      // Find the submit button (it's in a form inside the dialog)
      const submitButtons = screen.getAllByRole('button', {
        name: 'Add Subscription',
      });
      const formSubmitButton = submitButtons[submitButtons.length - 1];

      // Wait for button to be enabled and click it
      await waitFor(() => {
        expect(formSubmitButton).not.toBeDisabled();
      });
      fireEvent.click(formSubmitButton);

      // Wait for saveEncryptedData to be called
      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Check that saveEncryptedData was called with a record containing the entered name
      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value.records).toContainEqual(
        expect.objectContaining({ name: 'Disney Plus' }),
      );

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
      });

      // New subscription should appear in the list
      await waitFor(() => {
        expect(screen.getByText('Disney Plus')).toBeInTheDocument();
      });
    });

    it('should keep add dialog open with values intact if save fails', async () => {
      mockHandleLoadFn = jest.fn().mockResolvedValue([]);
      mockHandleSaveFn = jest.fn().mockRejectedValue(new Error('Save failed'));

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(mockHandleLoadFn).toHaveBeenCalled();
      });

      // Open add dialog
      const addButton = screen.getByRole('button', {
        name: 'Add Subscription',
      });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      });

      // Fill in the name field
      const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Hulu' } });

      // Trigger validation by blurring
      fireEvent.blur(nameInput);

      // Submit the form
      const submitButtons = screen.getAllByRole('button', {
        name: 'Add Subscription',
      });
      const formSubmitButton = submitButtons[submitButtons.length - 1];

      // Wait for button to be enabled and click it
      await waitFor(() => {
        expect(formSubmitButton).not.toBeDisabled();
      });
      fireEvent.click(formSubmitButton);

      // Wait for saveEncryptedData to be called
      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Dialog should still be open
      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();

      // The entered value should still be in the input
      const input = screen.getByLabelText('Name *') as HTMLInputElement;
      expect(input.value).toBe('Hulu');

      // Error toast should show
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to save',
            variant: 'destructive',
          }),
        );
      });
    });

    it('should stamp ISO updatedAt on new subscription', async () => {
      mockHandleLoadFn = jest.fn().mockResolvedValue([]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);
      const beforeTime = new Date();

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(mockHandleLoadFn).toHaveBeenCalled();
      });

      const addButton = screen.getByRole('button', {
        name: 'Add Subscription',
      });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'New Service' } });
      fireEvent.blur(nameInput);

      const submitButtons = screen.getAllByRole('button', {
        name: 'Add Subscription',
      });
      const formSubmitButton = submitButtons[submitButtons.length - 1];

      await waitFor(() => {
        expect(formSubmitButton).not.toBeDisabled();
      });
      fireEvent.click(formSubmitButton);

      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const records = lastCall[0].value.records;

      expect(records).toHaveLength(1);
      const newRecord = records[0];
      expect(newRecord).toHaveProperty('updatedAt');
      // Verify it's a valid ISO string and within reasonable time bounds
      const updatedAtTime = new Date(newRecord.updatedAt);
      const afterTime = new Date();
      expect(updatedAtTime.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime() - 100,
      );
      expect(updatedAtTime.getTime()).toBeLessThanOrEqual(
        afterTime.getTime() + 100,
      );
      expect(newRecord.updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('Edit subscription', () => {
    it('should open edit dialog when Edit button clicked on a subscription', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Netflix' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Netflix')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-sub1');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Subscription')).toBeInTheDocument();
      });
    });

    it('should update subscription when edit form is changed and saved', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Netflix' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Netflix')).toBeInTheDocument();
      });

      // Open edit dialog
      const editButton = screen.getByTestId('edit-sub1');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Subscription')).toBeInTheDocument();
      });

      // The name field should be prefilled with current value
      const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
      expect(nameInput.value).toBe('Netflix');

      // Change the name
      fireEvent.change(nameInput, { target: { value: 'Netflix Premium' } });

      // Trigger validation by blurring
      fireEvent.blur(nameInput);

      // Submit the form (find the Save button)
      const saveButton = screen.getByRole('button', { name: 'Save' });

      // Wait for button to be enabled and click it
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
      fireEvent.click(saveButton);

      // Wait for saveEncryptedData to be called
      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Check that saveEncryptedData was called with the updated record
      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value.records).toContainEqual(
        expect.objectContaining({ id: 'sub1', name: 'Netflix Premium' }),
      );

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
      });

      // List should show the updated name
      await waitFor(() => {
        expect(screen.getByText('Netflix Premium')).toBeInTheDocument();
      });
    });
  });

  describe('Delete subscription', () => {
    it('should open confirm delete dialog when Delete button clicked', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Adobe' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Adobe')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });
    });

    it('should show subscription name in confirm delete dialog title', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Photoshop' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Photoshop')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      // Dialog title should contain the subscription name
      expect(screen.getByText('Delete "Photoshop"?')).toBeInTheDocument();
    });

    it('should not call saveEncryptedData when Delete button clicked (only when confirmed)', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Adobe CC' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Adobe CC')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      // saveEncryptedData should not have been called yet
      expect(mockHandleSaveFn).not.toHaveBeenCalled();
    });

    it('should call saveEncryptedData when confirm delete clicked', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Figma' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Figma')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // The call should have empty array (subscription removed)
      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value.records).toHaveLength(0); // Subscription removed
    });

    it('should remove subscription from list after confirmed delete', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Slack' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Slack')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Subscription row should be gone
      await waitFor(() => {
        expect(
          screen.queryByTestId('subscription-row-sub1'),
        ).not.toBeInTheDocument();
      });
    });

    it('should close delete dialog after confirmed delete', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Zoom' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Zoom')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
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

    it('should show success toast after confirmed delete', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Notion' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Notion')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Deleted',
            description: expect.stringContaining('removed'),
          }),
        );
      });
    });

    it('should close delete dialog when Cancel button clicked', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Asana' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Asana')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
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

    it('should not call saveEncryptedData when cancel delete', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Asana' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Asana')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('delete-cancel-btn');
      fireEvent.click(cancelButton);

      // saveEncryptedData should not have been called
      expect(mockHandleSaveFn).not.toHaveBeenCalled();
    });

    it('should keep subscription in list after cancel delete', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Trello' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Trello')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('delete-cancel-btn');
      fireEvent.click(cancelButton);

      // Subscription should still be visible
      expect(screen.getByText('Trello')).toBeInTheDocument();
    });

    it('should record deletion with ISO timestamp and exclude record from list', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Hulu' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Hulu')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Verify the deletion log contains the deleted subscription ID with a valid ISO timestamp
      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const envelope = lastCall[0].value;

      expect(envelope.records).toHaveLength(0);
      expect(envelope.deletions).toHaveProperty('sub1');
      // Verify the timestamp is a valid ISO string
      const deletedAt = envelope.deletions.sub1;
      expect(deletedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should preserve existing deletion log when deleting another record', async () => {
      const sub1 = makeSubscriptionRecord('sub1', { name: 'Netflix' });
      const sub2 = makeSubscriptionRecord('sub2', { name: 'Spotify' });
      const existingEnvelope = {
        records: [sub1, sub2],
        deletions: { old_id: '2024-01-01T00:00:00.000Z' },
      };
      mockHandleLoadFn = jest.fn().mockResolvedValue(existingEnvelope);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Netflix')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Verify both the old deletion and the new one are in the log
      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const envelope = lastCall[0].value;

      expect(envelope.deletions).toHaveProperty('old_id');
      expect(envelope.deletions).toHaveProperty('sub1');
      expect(envelope.deletions.old_id).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should stamp ISO updatedAt and preserve deletion log on edit', async () => {
      const sub = makeSubscriptionRecord('sub1', {
        name: 'Original Name',
        updatedAt: '2024-06-01T10:00:00.000Z',
      });
      const existingEnvelope = {
        records: [sub],
        deletions: { old_sub: '2024-01-01T00:00:00.000Z' },
      };
      mockHandleLoadFn = jest.fn().mockResolvedValue(existingEnvelope);
      mockHandleSaveFn = jest.fn().mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Original Name')).toBeInTheDocument();
      });

      const editButton = screen.getByTestId('edit-sub1');
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Subscription')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('Name *') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
      fireEvent.blur(nameInput);

      const saveButton = screen.getByRole('button', { name: 'Save' });

      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      const calls = (mockHandleSaveFn as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const envelope = lastCall[0].value;

      // Verify deletion log is preserved
      expect(envelope.deletions).toHaveProperty('old_sub');
      expect(envelope.deletions.old_sub).toBe('2024-01-01T00:00:00.000Z');

      // Verify updatedAt was stamped (should be different from original)
      const updated = envelope.records[0];
      expect(updated.updatedAt).not.toBe('2024-06-01T10:00:00.000Z');
      expect(updated.updatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should keep dialog open and record in list if delete save fails', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Expensive Service' });
      mockHandleLoadFn = jest.fn().mockResolvedValue([sub]);
      mockHandleSaveFn = jest.fn().mockRejectedValue(new Error('Save failed'));

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Expensive Service')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTestId('delete-sub1');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByTestId('delete-confirm-btn');
      fireEvent.click(confirmButton);

      // Wait for save to be attempted and fail
      await waitFor(() => {
        expect(mockHandleSaveFn).toHaveBeenCalled();
      });

      // Dialog should still be open
      expect(screen.getByTestId('confirm-delete-dialog')).toBeInTheDocument();

      // Record should still be visible in the list
      expect(screen.getByText('Expensive Service')).toBeInTheDocument();

      // Error toast should show
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Failed to save',
            variant: 'destructive',
          }),
        );
      });
    });
  });

  describe('Multiple subscriptions', () => {
    it('should display all subscriptions loaded from vault', async () => {
      const subs = [
        makeSubscriptionRecord('sub1', { name: 'Netflix' }),
        makeSubscriptionRecord('sub2', { name: 'Spotify' }),
        makeSubscriptionRecord('sub3', { name: 'Adobe' }),
      ];
      mockHandleLoadFn = jest.fn().mockResolvedValue(subs);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Netflix')).toBeInTheDocument();
        expect(screen.getByText('Spotify')).toBeInTheDocument();
        expect(screen.getByText('Adobe')).toBeInTheDocument();
      });
    });

    it('should sort subscriptions by name', async () => {
      const subs = [
        makeSubscriptionRecord('sub1', { name: 'Zoom' }),
        makeSubscriptionRecord('sub2', { name: 'Adobe' }),
        makeSubscriptionRecord('sub3', { name: 'Netflix' }),
      ];
      mockHandleLoadFn = jest.fn().mockResolvedValue(subs);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(screen.getByText('Adobe')).toBeInTheDocument();
      });

      // Check that Adobe appears before Netflix (alphabetical order)
      const adobeElement = screen.getByText('Adobe');
      const netflixElement = screen.getByText('Netflix');
      expect(
        adobeElement.compareDocumentPosition(netflixElement) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });
});
