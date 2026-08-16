'use client';

import {
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
  convertAmount,
  getAccountSettings,
  getFxRates,
  randomId,
  subscribeAccountSettings,
  type CurrencyCode,
  type SubscriptionRecord,
} from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeSubscriptions,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type BaseSyntheticEvent,
} from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { dateInputToIso, todayAsDateInput } from '../utils/date';
import {
  AddSubscriptionCard,
  addSubscriptionSchema,
  type AddSubscriptionFormValues,
} from './AddSubscriptionCard';
import { SubscriptionsListCard } from './SubscriptionsListCard';
import {
  SubscriptionsTotalsCard,
  type CycleConvertedSubtotal,
  type CycleCurrencySubtotal,
} from './SubscriptionsTotalsCard';

interface SubscriptionsInnerProps {
  masterKeyBytes: Uint8Array;
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

  const addForm = useForm<AddSubscriptionFormValues>({
    resolver: zodResolver(addSubscriptionSchema),
    defaultValues: {
      name: '',
      status: SubscriptionStatusEnum.Active,
      billingCycle: SubscriptionBillingCycleEnum.Monthly,
      amount: 0,
      currency: 'AUD',
      paymentMethod: SubscriptionPaymentMethodEnum.CreditCard,
      renewalType: SubscriptionRenewalTypeEnum.AutoRenew,
      tier: SubscriptionTierEnum.Basic,
      startDate: todayAsDateInput(),
      nextBillingDate: '',
      link: '',
    },
    mode: 'onChange',
  });

  const canAdd = addForm.formState.isValid;

  useEffect(() => {
    const apply = () => {
      const settings = getAccountSettings();
      setPreferredCurrency(settings.preferredCurrency);
    };

    apply();
    return subscribeAccountSettings(apply);
  }, []);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'subscriptions',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeSubscriptions(raw);
        setItems(normalized.value);
        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes: props.masterKeyBytes,
            type: 'subscriptions',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        toast({
          title: 'Failed to load subscriptions',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      });
  }, [props.masterKeyBytes, toast]);

  const persist = useCallback(
    async (next: SubscriptionRecord[]) => {
      setItems(next);
      try {
        await saveEncryptedData({
          masterKeyBytes: props.masterKeyBytes,
          type: 'subscriptions',
          value: next,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        toast({
          title: 'Failed to save',
          description: message,
          variant: 'destructive',
        });
      }
    },
    [props.masterKeyBytes, toast],
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
    async (e?: BaseSyntheticEvent) => {
      return addForm.handleSubmit(async (values) => {
        const startDateIso = dateInputToIso(values.startDate);
        if (!startDateIso) {
          toast({
            title: 'Invalid start date',
            description: 'Please enter a valid start date.',
            variant: 'destructive',
          });
          return;
        }

        const nextBillingIso = dateInputToIso(values.nextBillingDate);

        const nextItem: SubscriptionRecord = {
          id: randomId(),
          name: values.name.trim(),
          startDate: startDateIso,
          endDate: undefined,
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
        addForm.reset({
          ...values,
          name: '',
          amount: 0,
          nextBillingDate: '',
          link: '',
        });
        toast({
          title: 'Saved',
          description: 'Subscription saved (encrypted).',
        });
      })(e);
    },
    [addForm, items, persist, toast],
  );

  const handleDeleteSubscription = useCallback(
    async (id: string) => {
      await persist(items.filter((x) => x.id !== id));
      toast({
        title: 'Deleted',
        description: 'Subscription removed.',
      });
    },
    [items, persist, toast],
  );

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
      <AddSubscriptionCard
        form={addForm}
        canAdd={canAdd}
        onSubmit={handleAddSubscription}
      />
      <SubscriptionsListCard
        subscriptions={sorted}
        onDeleteSubscription={handleDeleteSubscription}
      />
    </div>
  );
}
export function SubscriptionsPageClient() {
  return (
    <VaultGate title="Subscriptions">
      {({ masterKeyBytes }) => (
        <SubscriptionsInner masterKeyBytes={masterKeyBytes} />
      )}
    </VaultGate>
  );
}
