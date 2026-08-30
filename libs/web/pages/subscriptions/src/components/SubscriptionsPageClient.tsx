'use client';

import {
  SubscriptionStatusEnum,
  convertAmount,
  getAccountSettings,
  getFxRates,
  randomId,
  subscribeAccountSettings,
  type CurrencyCode,
  type SubscriptionRecord,
} from '@myorganizer/core';
import { Button, ConfirmDeleteDialog, useToast } from '@myorganizer/web-ui';
import {
  normalizeSubscriptions,
  type VaultHandle,
} from '@myorganizer/web-vault';
import { useLocalVaultRevision, VaultGate } from '@myorganizer/web-vault-ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { dateInputToIso } from '../utils/date';
import { type SubscriptionFormValues } from '../schemas/subscription';
import { SubscriptionAddDialog } from './SubscriptionAddDialog';
import { SubscriptionEditDialog } from './SubscriptionEditDialog';
import { SubscriptionsListCard } from './SubscriptionsListCard';
import {
  SubscriptionsTotalsCard,
  type CycleConvertedSubtotal,
  type CycleCurrencySubtotal,
} from './SubscriptionsTotalsCard';

interface SubscriptionsInnerProps {
  handle: VaultHandle;
}

function SubscriptionsInner(props: SubscriptionsInnerProps) {
  const { toast } = useToast();

  const [items, setItems] = useState<SubscriptionRecord[]>([]);
  const [preferredCurrency, setPreferredCurrency] =
    useState<CurrencyCode>('AUD');
  const [convertedTotals, setConvertedTotals] = useState<{
    enabled: boolean;
    loading: boolean;
    error?: string;
    totals: CycleConvertedSubtotal[];
  }>({ enabled: false, loading: false, totals: [] });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSubscription, setEditingSubscription] =
    useState<SubscriptionRecord | null>(null);
  const [deletingSubscription, setDeletingSubscription] =
    useState<SubscriptionRecord | null>(null);

  // Convergence replaces the Local Vault without passing through this
  // component, so the revision is the only thing that says the Ciphertext
  // behind `items` moved. Every mutation below saves the whole list, so a
  // stale `items` is not merely out of date on screen — it is what gets
  // written back over the record that arrived (#587).
  const revision = useLocalVaultRevision();

  useEffect(() => {
    const apply = () => {
      const settings = getAccountSettings();
      setPreferredCurrency(settings.preferredCurrency);
    };

    apply();
    return subscribeAccountSettings(apply);
  }, []);

  useEffect(() => {
    // Cancellation matters now that this effect re-fires on every convergence:
    // without it, an earlier read resolving late can put stale records back
    // over the ones a later read just applied.
    let isActive = true;

    props.handle
      .loadDecryptedData<unknown>({
        type: 'subscriptions',
        defaultValue: [],
      })
      .then(async (raw) => {
        const normalized = normalizeSubscriptions(raw);
        if (isActive) setItems(normalized.value);
        if (normalized.changed) {
          await props.handle.saveEncryptedData({
            type: 'subscriptions',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        if (!isActive) return;
        toast({
          title: 'Failed to load subscriptions',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      });

    return () => {
      isActive = false;
    };
  }, [props.handle, toast, revision]);

  const persist = useCallback(
    async (next: SubscriptionRecord[]) => {
      try {
        await props.handle.saveEncryptedData({
          type: 'subscriptions',
          value: next,
        });
        setItems(next);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        toast({
          title: 'Failed to save',
          description: message,
          variant: 'destructive',
        });
        throw e;
      }
    },
    [props.handle, toast],
  );

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const activeItems = useMemo(() => {
    return items.filter((s) => s.status === SubscriptionStatusEnum.Active);
  }, [items]);

  const nativeSubtotals = useMemo((): CycleCurrencySubtotal[] => {
    const map = new Map<string, CycleCurrencySubtotal>();
    for (const s of activeItems) {
      const key = `${s.billingCycle}|${s.currency}`;
      const existing = map.get(key);
      if (existing) {
        existing.total += s.amount;
        existing.count += 1;
      } else {
        map.set(key, {
          billingCycle: s.billingCycle,
          currency: s.currency,
          total: s.amount,
          count: 1,
        });
      }
    }

    return [...map.values()].sort((a, b) => {
      if (a.billingCycle !== b.billingCycle)
        return a.billingCycle.localeCompare(b.billingCycle);
      return a.currency.localeCompare(b.currency);
    });
  }, [activeItems]);

  const convertTotalsOnDemand = useCallback(async () => {
    setConvertedTotals({ enabled: true, loading: true, totals: [] });
    try {
      const fromCurrencies = Array.from(
        new Set(activeItems.map((s) => s.currency)),
      );
      const ratesByFrom = new Map<
        CurrencyCode,
        Awaited<ReturnType<typeof getFxRates>>
      >();

      await Promise.all(
        fromCurrencies.map(async (from) => {
          if (from === preferredCurrency) return;
          const rates = await getFxRates({ base: from });
          ratesByFrom.set(from, rates);
        }),
      );

      const map = new Map<string, CycleConvertedSubtotal>();
      for (const s of activeItems) {
        const key = s.billingCycle;
        const existing = map.get(key);

        let amountInPreferred = s.amount;
        if (s.currency !== preferredCurrency) {
          const rates = ratesByFrom.get(s.currency);
          if (!rates) {
            throw new Error(`Missing FX rates for ${s.currency}`);
          }
          amountInPreferred = convertAmount({
            amount: s.amount,
            from: s.currency,
            to: preferredCurrency,
            rates,
          });
        }

        if (existing) {
          existing.total += amountInPreferred;
          existing.count += 1;
        } else {
          map.set(key, {
            billingCycle: s.billingCycle,
            currency: preferredCurrency,
            total: amountInPreferred,
            count: 1,
          });
        }
      }

      const totals = [...map.values()].sort((a, b) =>
        a.billingCycle.localeCompare(b.billingCycle),
      );
      setConvertedTotals({ enabled: true, loading: false, totals });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setConvertedTotals({
        enabled: true,
        loading: false,
        error: message,
        totals: [],
      });
      toast({
        title: 'Conversion failed',
        description: message,
        variant: 'destructive',
      });
    }
  }, [activeItems, preferredCurrency, toast]);

  const resetConversion = useCallback(() => {
    setConvertedTotals({ enabled: false, loading: false, totals: [] });
  }, []);

  const handleAddSubscription = useCallback(
    async (values: SubscriptionFormValues) => {
      const startDateIso = dateInputToIso(values.startDate);
      if (!startDateIso) {
        toast({
          title: 'Invalid start date',
          description: 'Please enter a valid start date.',
          variant: 'destructive',
        });
        throw new Error('Invalid start date');
      }

      const endDateIso = dateInputToIso(values.endDate);
      const nextBillingIso = dateInputToIso(values.nextBillingDate);

      const nextItem: SubscriptionRecord = {
        id: randomId(),
        name: values.name.trim(),
        startDate: startDateIso,
        endDate: endDateIso,
        status: values.status,
        billingCycle: values.billingCycle,
        amount: values.amount,
        currency: values.currency as CurrencyCode,
        paymentMethod: values.paymentMethod,
        nextBillingDate: nextBillingIso,
        renewalType: values.renewalType,
        cancellationDate: undefined,
        cancellationReason: undefined,
        tier: values.tier,
        link: values.link?.trim() || undefined,
      };

      await persist([nextItem, ...items]);
      toast({
        title: 'Saved',
        description: 'Subscription saved (encrypted).',
      });
    },
    [items, persist, toast],
  );

  const handleSaveEdit = useCallback(
    async (id: string, values: SubscriptionFormValues) => {
      const startDateIso = dateInputToIso(values.startDate);
      if (!startDateIso) {
        toast({
          title: 'Invalid start date',
          description: 'Please enter a valid start date.',
          variant: 'destructive',
        });
        throw new Error('Invalid start date');
      }

      const endDateIso = dateInputToIso(values.endDate);
      const nextBillingIso = dateInputToIso(values.nextBillingDate);

      const next = items.map((s) =>
        s.id === id
          ? {
              ...s,
              name: values.name.trim(),
              startDate: startDateIso,
              endDate: endDateIso,
              status: values.status,
              billingCycle: values.billingCycle,
              amount: values.amount,
              currency: values.currency as CurrencyCode,
              paymentMethod: values.paymentMethod,
              nextBillingDate: nextBillingIso,
              renewalType: values.renewalType,
              tier: values.tier,
              link: values.link?.trim() || undefined,
            }
          : s,
      );

      await persist(next);
      toast({
        title: 'Saved',
        description: 'Subscription updated (encrypted).',
      });
    },
    [items, persist, toast],
  );

  const handleRequestEdit = useCallback(
    (id: string) => {
      const record = items.find((s) => s.id === id);
      if (record) {
        setEditingSubscription(record);
      }
    },
    [items],
  );

  const handleRequestDelete = useCallback(
    (id: string) => {
      const record = items.find((s) => s.id === id);
      if (record) {
        setDeletingSubscription(record);
      }
    },
    [items],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingSubscription) return;
    try {
      await persist(items.filter((s) => s.id !== deletingSubscription.id));
      toast({ title: 'Deleted', description: 'Subscription removed.' });
      setDeletingSubscription(null);
    } catch {
      // persist() already toasted the failure; leave the dialog open for retry
    }
  }, [deletingSubscription, items, persist, toast]);

  const handleOpenAddDialog = useCallback(() => {
    setShowAddDialog(true);
  }, []);

  const handleCloseAddDialog = useCallback(() => {
    setShowAddDialog(false);
  }, []);

  const handleCloseEditDialog = useCallback(() => {
    setEditingSubscription(null);
  }, []);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeletingSubscription(null);
    }
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <SubscriptionsTotalsCard
        preferredCurrency={preferredCurrency}
        convertedTotals={convertedTotals}
        nativeSubtotals={nativeSubtotals}
        hasActiveSubscriptions={activeItems.length > 0}
        onConvertTotals={convertTotalsOnDemand}
        onResetConversion={resetConversion}
      />
      <div className="flex justify-end">
        <Button onClick={handleOpenAddDialog}>Add Subscription</Button>
      </div>
      <SubscriptionsListCard
        subscriptions={sorted}
        onEditSubscription={handleRequestEdit}
        onRequestDelete={handleRequestDelete}
      />
      <SubscriptionAddDialog
        isOpen={showAddDialog}
        onClose={handleCloseAddDialog}
        onSubmit={handleAddSubscription}
      />
      <SubscriptionEditDialog
        subscription={editingSubscription}
        isOpen={editingSubscription !== null}
        onClose={handleCloseEditDialog}
        onSave={handleSaveEdit}
      />
      <ConfirmDeleteDialog
        open={deletingSubscription !== null}
        onOpenChange={handleDeleteDialogOpenChange}
        title={
          deletingSubscription ? `Delete "${deletingSubscription.name}"?` : ''
        }
        description="This action cannot be undone. The subscription will be permanently removed."
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
export function SubscriptionsPageClient() {
  return (
    <VaultGate title="Subscriptions">
      {({ handle }) => <SubscriptionsInner handle={handle!} />}
    </VaultGate>
  );
}
