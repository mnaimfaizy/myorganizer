'use client';

import { getAccessToken } from '@myorganizer/auth';
import {
  COUNTRIES,
  getAccountSettings,
  getApiBaseUrl,
  setAccountSettings,
  subscribeAccountSettings,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from '@myorganizer/core';
import { useLatestBackup } from '@myorganizer/web-pages/vault-settings';
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@myorganizer/web-ui';
import { LastBackupCard } from '@myorganizer/web-vault-ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function AccountPageClient() {
  const { toast } = useToast();

  const [countryCode, setCountryCode] = useState<string>('AU');
  const [preferredCurrency, setPreferredCurrency] =
    useState<CurrencyCode>('AUD');

  // YouTube notification settings
  const [ytInterval, setYtInterval] = useState(7);
  const [ytEnabled, setYtEnabled] = useState(true);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytConnected, setYtConnected] = useState(false);

  useEffect(() => {
    const apply = () => {
      const settings = getAccountSettings();
      setCountryCode(settings.countryCode);
      setPreferredCurrency(settings.preferredCurrency);
    };

    apply();
    return subscribeAccountSettings(apply);
  }, []);

  // Fetch YouTube notification settings
  useEffect(() => {
    (async () => {
      try {
        const token = getAccessToken();
        const authHeaders = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;
        const status = await fetch(`${getApiBaseUrl()}/youtube/status`, {
          headers: authHeaders,
          credentials: 'include',
        });
        if (!status.ok) return;
        const statusData = await status.json();
        setYtConnected(statusData.connected);
        if (!statusData.connected) return;

        const res = await fetch(
          `${getApiBaseUrl()}/youtube/notification-settings`,
          {
            headers: authHeaders,
            credentials: 'include',
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        setYtInterval(data.intervalDays);
        setYtEnabled(data.enabled);
      } catch {
        // YouTube not connected or API unavailable
      }
    })();
  }, []);

  const saveYouTubeSettings = useCallback(async () => {
    setYtLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${getApiBaseUrl()}/youtube/notification-settings`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            intervalDays: ytInterval,
            enabled: ytEnabled,
          }),
        },
      );
      if (!res.ok) throw new Error('Failed to save');
      toast({
        title: 'Saved',
        description: 'YouTube notification settings updated.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update YouTube settings.',
        variant: 'destructive',
      });
    } finally {
      setYtLoading(false);
    }
  }, [ytInterval, ytEnabled, toast]);

  const countries = useMemo(() => COUNTRIES, []);

  const latestBackup = useLatestBackup();
  const latestBackupRecord =
    latestBackup.status === 'loaded'
      ? latestBackup.record
      : latestBackup.status === 'empty'
        ? null
        : undefined;

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
      <div className="flex flex-col gap-2">
        <LastBackupCard
          record={latestBackupRecord}
          isLoading={latestBackup.status === 'loading'}
        />
        <Link
          href="/dashboard/account/vault"
          className="text-sm text-primary underline"
        >
          Manage vault export &amp; import →
        </Link>
      </div>
      <Card className="p-4">
        <CardTitle className="text-lg">Settings</CardTitle>{' '}
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

      {ytConnected && (
        <Card className="p-4">
          <CardTitle className="text-lg">YouTube Notifications</CardTitle>
          <CardContent className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Notification interval (days)</Label>
              <Input
                type="number"
                min={2}
                max={15}
                value={ytInterval}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val >= 2 && val <= 15) setYtInterval(val);
                }}
              />
              <p className="text-xs text-gray-500">
                Receive an email digest every {ytInterval} day
                {ytInterval !== 1 ? 's' : ''} with new videos from your
                subscriptions. (Min: 2, Max: 15)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={ytEnabled}
                  onChange={() => setYtEnabled(!ytEnabled)}
                  className="peer sr-only"
                />
                <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
              </label>
              <Label>Enable email notifications</Label>
            </div>

            <Button
              onClick={saveYouTubeSettings}
              disabled={ytLoading}
              className="w-full"
            >
              {ytLoading ? 'Saving…' : 'Save YouTube Settings'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
