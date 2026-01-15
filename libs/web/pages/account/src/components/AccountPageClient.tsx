'use client';

import {
  COUNTRIES,
  getAccountSettings,
  setAccountSettings,
  subscribeAccountSettings,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from '@myorganizer/core';
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@myorganizer/web-ui';
import { useEffect, useMemo, useState } from 'react';

export function AccountPageClient() {
  const { toast } = useToast();

  const [countryCode, setCountryCode] = useState<string>('AU');
  const [preferredCurrency, setPreferredCurrency] =
    useState<CurrencyCode>('AUD');

  useEffect(() => {
    const apply = () => {
      const settings = getAccountSettings();
      setCountryCode(settings.countryCode);
      setPreferredCurrency(settings.preferredCurrency);
    };

    apply();
    return subscribeAccountSettings(apply);
  }, []);

  const countries = useMemo(() => COUNTRIES, []);

  function persist(next: {
    countryCode: string;
    preferredCurrency: CurrencyCode;
  }) {
    setAccountSettings(next);
    toast({
      title: 'Saved',
      description: 'Account settings updated.',
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card className="p-4">
        <CardTitle className="text-lg">Settings</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select
              value={countryCode}
              onValueChange={(v) => setCountryCode(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Preferred currency</Label>
            <Select
              value={preferredCurrency}
              onValueChange={(v) => setPreferredCurrency(v as CurrencyCode)}
            >
              <SelectTrigger>
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

          <Button
            onClick={() =>
              persist({
                countryCode,
                preferredCurrency,
              })
            }
            className="w-full"
          >
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
