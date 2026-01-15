'use client';

import {
  SUPPORTED_CURRENCIES,
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
  type CurrencyCode,
  type SubscriptionRecord,
} from '@myorganizer/core';
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  DatePicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeSubscriptions,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';

import { dateInputToIso, isoToDateInput } from '../utils/date';
import {
  getSubscriptionBillingCycleLabel,
  getSubscriptionPaymentMethodLabel,
  getSubscriptionRenewalTypeLabel,
  getSubscriptionStatusLabel,
  getSubscriptionTierLabel,
} from '../utils/presentation';

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
  amount: z.coerce.number().finite().min(0, 'Amount must be >= 0'),
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

type EditValues = z.infer<typeof editSchema>;

function SubscriptionDetailInner(props: {
  masterKeyBytes: Uint8Array;
  subscriptionId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [record, setRecord] = useState<SubscriptionRecord | null>(null);

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
    setLoading(true);
    setNotFound(false);

    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'subscriptions',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeSubscriptions(raw);
        const found = normalized.value.find(
          (x) => x.id === props.subscriptionId
        );
        if (!found) {
          setNotFound(true);
          return;
        }

        setRecord(found);
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
          title: 'Failed to load subscription',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [form, props.masterKeyBytes, props.subscriptionId, toast]);

  const canSave = form.formState.isValid && !form.formState.isSubmitting;

  const backHref = useMemo(() => '/dashboard/subscriptions', []);

  async function save(values: EditValues) {
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
  }

  async function deleteRecord() {
    try {
      const raw = await loadDecryptedData<unknown>({
        masterKeyBytes: props.masterKeyBytes,
        type: 'subscriptions',
        defaultValue: [],
      });

      const normalized = normalizeSubscriptions(raw);
      const next = normalized.value.filter(
        (s) => s.id !== props.subscriptionId
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
  }

  if (loading) {
    return <div className="p-4">Loading…</div>;
  }

  if (notFound || !record) {
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

      <Card className="p-4">
        <CardTitle className="text-lg">Edit subscription</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...form.register('name')} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) =>
                  form.setValue('status', v as EditValues['status'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SubscriptionStatusEnum).map((v) => (
                    <SelectItem key={v} value={v}>
                      {getSubscriptionStatusLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-billing">Billing cycle</Label>
              <Select
                value={form.watch('billingCycle')}
                onValueChange={(v) =>
                  form.setValue(
                    'billingCycle',
                    v as EditValues['billingCycle'],
                    {
                      shouldValidate: true,
                    }
                  )
                }
              >
                <SelectTrigger id="edit-billing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SubscriptionBillingCycleEnum).map((v) => (
                    <SelectItem key={v} value={v}>
                      {getSubscriptionBillingCycleLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                {...form.register('amount')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-currency">Currency</Label>
              <Select
                value={form.watch('currency')}
                onValueChange={(v) =>
                  form.setValue('currency', v as EditValues['currency'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="edit-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-start">Start date</Label>
              <Controller
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    id="edit-start"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pick a start date"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-end">End date</Label>
              <Controller
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <DatePicker
                    id="edit-end"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pick an end date"
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-next">Next billing date</Label>
              <Controller
                control={form.control}
                name="nextBillingDate"
                render={({ field }) => (
                  <DatePicker
                    id="edit-next"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pick a billing date"
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-link">Link</Label>
              <Input id="edit-link" {...form.register('link')} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-payment">Payment method</Label>
              <Select
                value={form.watch('paymentMethod')}
                onValueChange={(v) =>
                  form.setValue(
                    'paymentMethod',
                    v as EditValues['paymentMethod'],
                    {
                      shouldValidate: true,
                    }
                  )
                }
              >
                <SelectTrigger id="edit-payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SubscriptionPaymentMethodEnum).map((v) => (
                    <SelectItem key={v} value={v}>
                      {getSubscriptionPaymentMethodLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-renewal">Renewal type</Label>
              <Select
                value={form.watch('renewalType')}
                onValueChange={(v) =>
                  form.setValue('renewalType', v as EditValues['renewalType'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="edit-renewal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SubscriptionRenewalTypeEnum).map((v) => (
                    <SelectItem key={v} value={v}>
                      {getSubscriptionRenewalTypeLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tier">Tier</Label>
              <Select
                value={form.watch('tier')}
                onValueChange={(v) =>
                  form.setValue('tier', v as EditValues['tier'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="edit-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(SubscriptionTierEnum).map((v) => (
                    <SelectItem key={v} value={v}>
                      {getSubscriptionTierLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              disabled={!canSave}
              onClick={form.handleSubmit(save)}
              className="flex-1"
            >
              Save
            </Button>
            <Button
              variant="destructive"
              onClick={deleteRecord}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function SubscriptionDetailPageClient(props: {
  params: { id: string };
}) {
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
