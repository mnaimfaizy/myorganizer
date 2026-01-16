'use client';

import {
  SUPPORTED_CURRENCIES,
  SubscriptionBillingCycleEnum,
  SubscriptionPaymentMethodEnum,
  SubscriptionRecord,
  SubscriptionRenewalTypeEnum,
  SubscriptionStatusEnum,
  SubscriptionTierEnum,
  convertAmount,
  formatMoney,
  getAccountSettings,
  getFxRates,
  randomId,
  subscribeAccountSettings,
  type CurrencyCode,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeSubscriptions,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';

import { dateInputToIso, isoToDateInput } from '../utils/date';
import {
  formatIsoDateForDisplay,
  getSubscriptionBillingCycleLabel,
  getSubscriptionPaymentMethodLabel,
  getSubscriptionRenewalTypeLabel,
  getSubscriptionStatusLabel,
  getSubscriptionTierLabel,
} from '../utils/presentation';

type CycleCurrencySubtotal = {
  billingCycle: SubscriptionRecord['billingCycle'];
  currency: CurrencyCode;
  total: number;
  count: number;
};

type CycleConvertedSubtotal = {
  billingCycle: SubscriptionRecord['billingCycle'];
  currency: CurrencyCode;
  total: number;
  count: number;
};

const addSubscriptionSchema = z.object({
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
  currency: z.custom<CurrencyCode>(
    (v) => typeof v === 'string' && v.length > 0,
  ),
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
  nextBillingDate: z.string().trim().optional(),
  link: z.string().trim().url().optional().or(z.literal('')),
});

type AddSubscriptionFormValues = z.infer<typeof addSubscriptionSchema>;

function SubscriptionsInner(props: { masterKeyBytes: Uint8Array }) {
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
      startDate: isoToDateInput(new Date().toISOString()),
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

  async function persist(next: SubscriptionRecord[]) {
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
  }

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

  async function convertTotalsOnDemand() {
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
  }

  function resetConversion() {
    setConvertedTotals({ enabled: false, loading: false, totals: [] });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card className="p-4">
        <CardTitle className="text-lg">Totals (active)</CardTitle>
        <CardContent className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Preferred currency:{' '}
              <span className="font-medium">{preferredCurrency}</span>
            </div>
            <div className="flex gap-2">
              {convertedTotals.enabled ? (
                <Button
                  variant="secondary"
                  onClick={resetConversion}
                  disabled={convertedTotals.loading}
                >
                  Show original
                </Button>
              ) : (
                <Button
                  onClick={() => void convertTotalsOnDemand()}
                  disabled={convertedTotals.loading || activeItems.length === 0}
                >
                  {convertedTotals.loading
                    ? 'Converting…'
                    : `Convert totals to ${preferredCurrency}`}
                </Button>
              )}
            </div>
          </div>

          {convertedTotals.enabled ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Billing cycle</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">
                    Total ({preferredCurrency})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convertedTotals.totals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      {convertedTotals.loading
                        ? 'Loading FX rates…'
                        : convertedTotals.error
                          ? convertedTotals.error
                          : 'No active subscriptions.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  convertedTotals.totals.map((t) => (
                    <TableRow key={t.billingCycle}>
                      <TableCell>
                        {getSubscriptionBillingCycleLabel(t.billingCycle)}
                      </TableCell>
                      <TableCell className="text-right">{t.count}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney({
                          amount: t.total,
                          currency: preferredCurrency,
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Billing cycle</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nativeSubtotals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No active subscriptions.
                    </TableCell>
                  </TableRow>
                ) : (
                  nativeSubtotals.map((t) => (
                    <TableRow key={`${t.billingCycle}|${t.currency}`}>
                      <TableCell>
                        {getSubscriptionBillingCycleLabel(t.billingCycle)}
                      </TableCell>
                      <TableCell>{t.currency}</TableCell>
                      <TableCell className="text-right">{t.count}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney({ amount: t.total, currency: t.currency })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardTitle className="text-lg">Add subscription</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sub-name">Name *</Label>
            <Input
              id="sub-name"
              {...addForm.register('name')}
              placeholder="Netflix"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sub-status">Status</Label>
              <Select
                value={addForm.watch('status')}
                onValueChange={(v) =>
                  addForm.setValue(
                    'status',
                    v as AddSubscriptionFormValues['status'],
                    {
                      shouldValidate: true,
                    },
                  )
                }
              >
                <SelectTrigger id="sub-status">
                  <SelectValue placeholder="Select status" />
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
              <Label htmlFor="sub-billing">Billing cycle</Label>
              <Select
                value={addForm.watch('billingCycle')}
                onValueChange={(v) =>
                  addForm.setValue(
                    'billingCycle',
                    v as AddSubscriptionFormValues['billingCycle'],
                    { shouldValidate: true },
                  )
                }
              >
                <SelectTrigger id="sub-billing">
                  <SelectValue placeholder="Select cycle" />
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
              <Label htmlFor="sub-amount">Amount</Label>
              <Input
                id="sub-amount"
                type="number"
                step="0.01"
                {...addForm.register('amount', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-currency">Currency</Label>
              <Select
                value={addForm.watch('currency')}
                onValueChange={(v) =>
                  addForm.setValue(
                    'currency',
                    v as AddSubscriptionFormValues['currency'],
                    {
                      shouldValidate: true,
                    },
                  )
                }
              >
                <SelectTrigger id="sub-currency">
                  <SelectValue placeholder="Select currency" />
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
              <Label htmlFor="sub-start">Start date *</Label>
              <Controller
                control={addForm.control}
                name="startDate"
                render={({ field }) => (
                  <DatePicker
                    id="sub-start"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pick a start date"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sub-next">Next billing date</Label>
              <Controller
                control={addForm.control}
                name="nextBillingDate"
                render={({ field }) => (
                  <DatePicker
                    id="sub-next"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pick a billing date"
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-link">Link</Label>
              <Input
                id="sub-link"
                {...addForm.register('link')}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sub-payment">Payment method</Label>
              <Select
                value={addForm.watch('paymentMethod')}
                onValueChange={(v) =>
                  addForm.setValue(
                    'paymentMethod',
                    v as AddSubscriptionFormValues['paymentMethod'],
                    { shouldValidate: true },
                  )
                }
              >
                <SelectTrigger id="sub-payment">
                  <SelectValue placeholder="Select payment method" />
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
              <Label htmlFor="sub-renewal">Renewal type</Label>
              <Select
                value={addForm.watch('renewalType')}
                onValueChange={(v) =>
                  addForm.setValue(
                    'renewalType',
                    v as AddSubscriptionFormValues['renewalType'],
                    { shouldValidate: true },
                  )
                }
              >
                <SelectTrigger id="sub-renewal">
                  <SelectValue placeholder="Select renewal" />
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
              <Label htmlFor="sub-tier">Tier</Label>
              <Select
                value={addForm.watch('tier')}
                onValueChange={(v) =>
                  addForm.setValue(
                    'tier',
                    v as AddSubscriptionFormValues['tier'],
                    {
                      shouldValidate: true,
                    },
                  )
                }
              >
                <SelectTrigger id="sub-tier">
                  <SelectValue placeholder="Select tier" />
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

          <Button
            disabled={!canAdd}
            onClick={addForm.handleSubmit(async (values) => {
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
            })}
            className="w-full"
          >
            Add Subscription
          </Button>
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardTitle className="text-lg">Subscriptions</CardTitle>
        <CardContent className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No subscriptions yet.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/dashboard/subscriptions/${s.id}`}
                          className="font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                        {s.link ? (
                          <a
                            href={s.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {s.link}
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getSubscriptionStatusLabel(s.status)}
                    </TableCell>
                    <TableCell>
                      {getSubscriptionBillingCycleLabel(s.billingCycle)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney({ amount: s.amount, currency: s.currency })}
                    </TableCell>
                    <TableCell>
                      {formatIsoDateForDisplay(s.nextBillingDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          await persist(items.filter((x) => x.id !== s.id));
                          toast({
                            title: 'Deleted',
                            description: 'Subscription removed.',
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
