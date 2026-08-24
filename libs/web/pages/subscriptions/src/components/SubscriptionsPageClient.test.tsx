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
  normalizeSubscriptions: jest.fn((data) => ({
    value: data || [],
    changed: false,
  })),
}));

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
import type { SubscriptionRecord } from '@myorganizer/core';
import {
  SubscriptionStatusEnum,
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionTierEnum,
} from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  saveEncryptedData,
  normalizeSubscriptions,
} from '@myorganizer/web-vault';
import { SubscriptionsPageClient } from './SubscriptionsPageClient';
/* eslint-enable import/first */

const mockUseToast = useToast as jest.Mock;
const mockLoadDecryptedData = loadDecryptedData as jest.Mock;
const mockSaveEncryptedData = saveEncryptedData as jest.Mock;
const mockNormalizeSubscriptions = normalizeSubscriptions as jest.Mock;

const mockToast = jest.fn();

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
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockLoadDecryptedData.mockResolvedValue([]);
    mockSaveEncryptedData.mockResolvedValue(undefined);
    mockNormalizeSubscriptions.mockImplementation((data) => ({
      value: data || [],
      changed: false,
    }));
  });

  describe('Initial render', () => {
    it('should not render add or edit dialog on first render before vault loads', () => {
      mockLoadDecryptedData.mockImplementation(
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
      mockLoadDecryptedData.mockResolvedValue([]);

      render(<SubscriptionsPageClient />);

      // Wait for vault load to complete
      await waitFor(() => {
        expect(mockLoadDecryptedData).toHaveBeenCalled();
      });

      // Dialog should not be visible initially
      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });
  });

  describe('Add subscription', () => {
    it('should open add dialog when Add Subscription button clicked', async () => {
      mockLoadDecryptedData.mockResolvedValue([]);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(mockLoadDecryptedData).toHaveBeenCalled();
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
      mockLoadDecryptedData.mockResolvedValue([]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(mockLoadDecryptedData).toHaveBeenCalled();
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
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });

      // Check that saveEncryptedData was called with a record containing the entered name
      const calls = (mockSaveEncryptedData as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value).toContainEqual(
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
      mockLoadDecryptedData.mockResolvedValue([]);
      mockSaveEncryptedData.mockRejectedValue(new Error('Save failed'));

      render(<SubscriptionsPageClient />);

      await waitFor(() => {
        expect(mockLoadDecryptedData).toHaveBeenCalled();
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
        expect(mockSaveEncryptedData).toHaveBeenCalled();
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
  });

  describe('Edit subscription', () => {
    it('should open edit dialog when Edit button clicked on a subscription', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Netflix' });
      mockLoadDecryptedData.mockResolvedValue([sub]);

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
      mockLoadDecryptedData.mockResolvedValue([sub]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

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
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });

      // Check that saveEncryptedData was called with the updated record
      const calls = (mockSaveEncryptedData as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value).toContainEqual(
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
      mockLoadDecryptedData.mockResolvedValue([sub]);

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
      mockLoadDecryptedData.mockResolvedValue([sub]);

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
      mockLoadDecryptedData.mockResolvedValue([sub]);

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
      expect(mockSaveEncryptedData).not.toHaveBeenCalled();
    });

    it('should call saveEncryptedData when confirm delete clicked', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Figma' });
      mockLoadDecryptedData.mockResolvedValue([sub]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

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
        expect(mockSaveEncryptedData).toHaveBeenCalled();
      });

      // The call should have empty array (subscription removed)
      const calls = (mockSaveEncryptedData as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0].value).toHaveLength(0); // Subscription removed
    });

    it('should remove subscription from list after confirmed delete', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Slack' });
      mockLoadDecryptedData.mockResolvedValue([sub]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

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
        expect(mockSaveEncryptedData).toHaveBeenCalled();
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
      mockLoadDecryptedData.mockResolvedValue([sub]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

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
      mockLoadDecryptedData.mockResolvedValue([sub]);
      mockSaveEncryptedData.mockResolvedValue(undefined);

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
      mockLoadDecryptedData.mockResolvedValue([sub]);

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
      mockLoadDecryptedData.mockResolvedValue([sub]);

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
      expect(mockSaveEncryptedData).not.toHaveBeenCalled();
    });

    it('should keep subscription in list after cancel delete', async () => {
      const sub = makeSubscriptionRecord('sub1', { name: 'Trello' });
      mockLoadDecryptedData.mockResolvedValue([sub]);

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
  });

  describe('Multiple subscriptions', () => {
    it('should display all subscriptions loaded from vault', async () => {
      const subs = [
        makeSubscriptionRecord('sub1', { name: 'Netflix' }),
        makeSubscriptionRecord('sub2', { name: 'Spotify' }),
        makeSubscriptionRecord('sub3', { name: 'Adobe' }),
      ];
      mockLoadDecryptedData.mockResolvedValue(subs);

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
      mockLoadDecryptedData.mockResolvedValue(subs);

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
