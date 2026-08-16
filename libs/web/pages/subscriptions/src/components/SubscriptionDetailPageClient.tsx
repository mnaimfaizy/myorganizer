'use client';

import {
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';

import { dateInputToIso, isoToDateInput } from '../utils/date';
import { EditSubscriptionCard } from './EditSubscriptionCard';

const editSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  status: z.enum([
    SubscriptionStatusEnum.Active,
    SubscriptionStatusEnum.Inactive,
    SubscriptionStatusEnum.Cancelled,
    SubscriptionStatusEnum.Expired,
    SubscriptionStatusEnum.Pending,
  ]),
  billingCycle: z.enum([
    SubscriptionBillingCycleEnum.Weekly,
    SubscriptionBillingCycleEnum.Fortnightly,
    SubscriptionBillingCycleEnum.Monthly,
    SubscriptionBillingCycleEnum.Quarterly,
    SubscriptionBillingCycleEnum.Yearly,
    SubscriptionBillingCycleEnum.TwoYears,
    SubscriptionBillingCycleEnum.ThreeYears,
  ]),
  amount: z.number().finite().min(0, 'Amount must be >= 0'),
  currency: z.string().min(1),
  paymentMethod: z.enum([
    SubscriptionPaymentMethodEnum.CreditCard,
    SubscriptionPaymentMethodEnum.PayPal,
    SubscriptionPaymentMethodEnum.BankTransfer,
  ]),
  renewalType: z.enum([
    SubscriptionRenewalTypeEnum.AutoRenew,
    SubscriptionRenewalTypeEnum.Manual,
  ]),
  tier: z.enum([
    SubscriptionTierEnum.Free,
    SubscriptionTierEnum.Basic,
    SubscriptionTierEnum.Pro,
    SubscriptionTierEnum.Enterprise,
    SubscriptionTierEnum.Individual,
    SubscriptionTierEnum.Family,
  ]),
  startDate: z.string().trim().min(1, 'Start date is required'),
  endDate: z.string().trim().optional(),
  nextBillingDate: z.string().trim().optional(),
  link: z.string().trim().url().optional().or(z.literal('')),
});

export type EditValues = z.infer<typeof editSchema>;

type LoadState =
  | {
      status: 'loading';
      subscriptionId: string;
      masterKeyBytes: Uint8Array;
    }
  | {
      status: 'ready';
      record: SubscriptionRecord;
      subscriptionId: string;
      masterKeyBytes: Uint8Array;
    }
  | {
      status: 'not-found';
      subscriptionId: string;
      masterKeyBytes: Uint8Array;
    };

interface SubscriptionDetailInnerProps {
  masterKeyBytes: Uint8Array;
  subscriptionId: string;
}

function SubscriptionDetailInner(props: SubscriptionDetailInnerProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [loadState, setLoadState] = useState<LoadState>({
    status: 'loading',
    subscriptionId: props.subscriptionId,
    masterKeyBytes: props.masterKeyBytes,
  });

  const isMatch =
    loadState.subscriptionId === props.subscriptionId &&
    loadState.masterKeyBytes === props.masterKeyBytes;

  const currentLoadState: LoadState = isMatch
    ? loadState
    : {
        status: 'loading',
        subscriptionId: props.subscriptionId,
        masterKeyBytes: props.masterKeyBytes,
      };

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: '',
      status: SubscriptionStatusEnum.Active,
      billingCycle: SubscriptionBillingCycleEnum.Monthly,
      amount: 0,
      currency: 'AUD',
      paymentMethod: SubscriptionPaymentMethodEnum.CreditCard,
      renewalType: SubscriptionRenewalTypeEnum.AutoRenew,
      tier: SubscriptionTierEnum.Basic,
      startDate: '',
      endDate: '',
      nextBillingDate: '',
      link: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    let cancelled = false;

    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'subscriptions',
      defaultValue: [],
    })
      .then(async (raw) => {
        if (cancelled) return;
        const normalized = normalizeSubscriptions(raw);
        const found = normalized.value.find(
          (x) => x.id === props.subscriptionId,
        );
        if (!found) {
          if (!cancelled) {
            setLoadState({
              status: 'not-found',
              subscriptionId: props.subscriptionId,
              masterKeyBytes: props.masterKeyBytes,
            });
          }
          return;
        }

        if (!cancelled) {
          form.reset({
            name: found.name,
            status: found.status,
            billingCycle: found.billingCycle,
            amount: found.amount,
            currency: found.currency,
            paymentMethod: found.paymentMethod,
            renewalType: found.renewalType,
            tier: found.tier,
            startDate: isoToDateInput(found.startDate),
            endDate: isoToDateInput(found.endDate),
            nextBillingDate: isoToDateInput(found.nextBillingDate),
            link: found.link ?? '',
          });

          setLoadState({
            status: 'ready',
            record: found,
            subscriptionId: props.subscriptionId,
            masterKeyBytes: props.masterKeyBytes,
          });
        }

        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes: props.masterKeyBytes,
            type: 'subscriptions',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        toast({
          title: 'Failed to load subscription',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
        setLoadState({
          status: 'not-found',
          subscriptionId: props.subscriptionId,
          masterKeyBytes: props.masterKeyBytes,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [form, props.masterKeyBytes, props.subscriptionId, toast]);

  const canSave = form.formState.isValid && !form.formState.isSubmitting;

  const backHref = useMemo(() => '/dashboard/subscriptions', []);

  const save = useCallback(
    async (values: EditValues) => {
      try {
        const startDateIso = dateInputToIso(values.startDate);
        if (!startDateIso) {
          toast({
            title: 'Invalid start date',
            description: 'Please enter a valid start date.',
            variant: 'destructive',
          });
          return;
        }

        const endDateIso = dateInputToIso(values.endDate);
        const nextBillingIso = dateInputToIso(values.nextBillingDate);

        const raw = await loadDecryptedData<unknown>({
          masterKeyBytes: props.masterKeyBytes,
          type: 'subscriptions',
          defaultValue: [],
        });

        const normalized = normalizeSubscriptions(raw);

        const next: SubscriptionRecord[] = normalized.value.map((s) => {
          if (s.id !== props.subscriptionId) return s;
          return {
            ...s,
            name: values.name.trim(),
            status: values.status,
            billingCycle: values.billingCycle,
            amount: values.amount,
            currency: values.currency as CurrencyCode,
            paymentMethod: values.paymentMethod,
            renewalType: values.renewalType,
            tier: values.tier,
            startDate: startDateIso,
            endDate: endDateIso,
            nextBillingDate: nextBillingIso,
            link: values.link?.trim() || undefined,
          };
        });

        await saveEncryptedData({
          masterKeyBytes: props.masterKeyBytes,
          type: 'subscriptions',
          value: next,
        });

        toast({
          title: 'Saved',
          description: 'Subscription updated (encrypted).',
        });

        router.push(backHref);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        toast({
          title: 'Failed to save',
          description: message,
          variant: 'destructive',
        });
      }
    },
    [backHref, props.masterKeyBytes, props.subscriptionId, router, toast],
  );

  const handleSave = useCallback(() => {
    void form.handleSubmit(save)();
  }, [form, save]);

  const deleteRecord = useCallback(async () => {
    try {
      const raw = await loadDecryptedData<unknown>({
        masterKeyBytes: props.masterKeyBytes,
        type: 'subscriptions',
        defaultValue: [],
      });

      const normalized = normalizeSubscriptions(raw);
      const next = normalized.value.filter(
        (s) => s.id !== props.subscriptionId,
      );

      await saveEncryptedData({
        masterKeyBytes: props.masterKeyBytes,
        type: 'subscriptions',
        value: next,
      });

      toast({
        title: 'Deleted',
        description: 'Subscription removed.',
      });

      router.push(backHref);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({
        title: 'Failed to delete',
        description: message,
        variant: 'destructive',
      });
    }
  }, [backHref, props.masterKeyBytes, props.subscriptionId, router, toast]);

  if (currentLoadState.status === 'loading') {
    return <div className="p-4">Loading…</div>;
  }

  if (currentLoadState.status === 'not-found') {
    return (
      <div className="p-4 space-y-2">
        <div className="text-lg font-semibold">Not found</div>
        <Link href={backHref} className="text-sm underline">
          Back to subscriptions
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Link href={backHref} className="text-sm underline">
        Back to subscriptions
      </Link>

      <EditSubscriptionCard
        form={form}
        canSave={canSave}
        onSave={handleSave}
        onDelete={deleteRecord}
      />
    </div>
  );
}
export interface SubscriptionDetailPageClientProps {
  params: { id: string };
}

export function SubscriptionDetailPageClient(
  props: SubscriptionDetailPageClientProps,
) {
  return (
    <VaultGate title="Subscription">
      {({ masterKeyBytes }) => (
        <SubscriptionDetailInner
          masterKeyBytes={masterKeyBytes}
          subscriptionId={props.params.id}
        />
      )}
    </VaultGate>
  );
}
