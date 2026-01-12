'use client';

import Link from 'next/link';

import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Checkbox,
  Combobox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@myorganizer/web-ui';
import { useEffect, useMemo, useState } from 'react';

import {
  OrganisationTypeEnum,
  PriorityEnum,
  UpdateMethodEnum,
  UsageLocationRecord,
} from '@myorganizer/core';

import VaultGate from '../../../../components/vault-gate';
import {
  loadDecryptedData,
  saveEncryptedData,
} from '../../../../lib/vault/vault';
import { normalizeAddresses } from '../../../../lib/vault/contactRecordNormalization';

function randomId(): string {
  return crypto.randomUUID();
}

function titleCase(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
}

function enumOptions<T extends Record<string, string>>(obj: T): string[] {
  return Object.values(obj);
}

function parseEnumValue<T extends Record<string, string>>(
  obj: T,
  input: string,
  fallback: T[keyof T]
): T[keyof T] {
  const trimmed = input.trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();

  for (const option of Object.values(obj)) {
    if (option.toLowerCase() === lower) return option as T[keyof T];
  }

  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) {
      return obj[key as keyof T];
    }
  }

  return fallback;
}

function AddressDetailsInner(props: {
  masterKeyBytes: Uint8Array;
  addressId: string;
}) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('');
  const [usageLocations, setUsageLocations] = useState<UsageLocationRecord[]>(
    []
  );

  // Add usage location form
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('government');
  const [updateMethod, setUpdateMethod] = useState('online');
  const [priority, setPriority] = useState('normal');
  const [link, setLink] = useState('');
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);

    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'addresses',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeAddresses(raw);
        const found = normalized.value.find((x) => x.id === props.addressId);
        if (!found) {
          setNotFound(true);
          return;
        }

        setLabel(found.label);
        setAddress(found.address);
        setStatus(found.status);
        setUsageLocations(found.usageLocations);

        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes: props.masterKeyBytes,
            type: 'addresses',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        toast({
          title: 'Failed to load address',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [props.addressId, props.masterKeyBytes, toast]);

  const orgTypeOptions = useMemo(
    () =>
      enumOptions(OrganisationTypeEnum).map((v) => ({
        value: v,
        label: titleCase(v),
      })),
    []
  );

  const updateMethodOptions = useMemo(
    () =>
      enumOptions(UpdateMethodEnum).map((v) => ({
        value: v,
        label: titleCase(v),
      })),
    []
  );

  const canAddUsage = useMemo(() => orgName.trim().length > 0, [orgName]);

  async function persistUsage(nextUsage: UsageLocationRecord[]) {
    const raw = await loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'addresses',
      defaultValue: [],
    });

    const normalized = normalizeAddresses(raw);
    const nextAddresses = normalized.value.map((x) =>
      x.id === props.addressId ? { ...x, usageLocations: nextUsage } : x
    );

    await saveEncryptedData({
      masterKeyBytes: props.masterKeyBytes,
      type: 'addresses',
      value: nextAddresses,
    });

    setUsageLocations(nextUsage);
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <p className="text-sm text-muted-foreground">Address not found.</p>
        <div>
          <Link
            href="/dashboard/addresses"
            className="text-sm underline-offset-4 hover:underline"
          >
            Back to addresses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div>
        <Link
          href="/dashboard/addresses"
          className="text-sm underline-offset-4 hover:underline"
        >
          Back to addresses
        </Link>
      </div>

      <Card className="p-4">
        <CardTitle className="text-lg">Address details</CardTitle>
        <CardContent className="mt-4 space-y-2">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground break-words">{address}</p>
          <p className="text-xs text-muted-foreground">Status: {status}</p>
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardTitle className="text-lg">Used at</CardTitle>
        <CardContent className="mt-4 space-y-3">
          {usageLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No usage locations yet.
            </p>
          ) : (
            usageLocations.map((u) => (
              <div key={u.id} className="space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.organisationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(u.organisationType)} •{' '}
                      {titleCase(u.updateMethod)}
                      {u.priority ? ` • ${titleCase(u.priority)}` : ''}
                      {u.changed ? ' • Changed' : ''}
                    </p>
                    {u.link ? (
                      <a
                        href={u.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        {u.link}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardTitle className="text-lg">Add location where used</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usage-org-name">Organisation name</Label>
            <Input
              id="usage-org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="ATO / Commbank / School"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage-org-type">Organisation type</Label>
            <Combobox
              id="usage-org-type"
              value={orgType}
              onValueChange={setOrgType}
              options={orgTypeOptions}
              placeholder="government / insurance / school"
              searchPlaceholder="Search organisation types..."
              emptyText="No organisation types found."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage-update-method">Update method</Label>
            <Combobox
              id="usage-update-method"
              value={updateMethod}
              onValueChange={setUpdateMethod}
              options={updateMethodOptions}
              placeholder="online / inPerson / phone / mail"
              searchPlaceholder="Search update methods..."
              emptyText="No update methods found."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage-priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="usage-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {enumOptions(PriorityEnum).map((v) => (
                  <SelectItem key={v} value={v}>
                    {titleCase(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage-link">Link to change (optional)</Label>
            <Input
              id="usage-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="usage-changed"
              checked={changed}
              onCheckedChange={(v) => setChanged(Boolean(v))}
            />
            <Label htmlFor="usage-changed">Already changed/updated</Label>
          </div>

          <Button
            disabled={!canAddUsage}
            onClick={async () => {
              const now = new Date().toISOString();
              const next: UsageLocationRecord = {
                id: randomId(),
                organisationName: orgName.trim(),
                organisationType: parseEnumValue(
                  OrganisationTypeEnum,
                  orgType,
                  OrganisationTypeEnum.Other
                ),
                updateMethod: parseEnumValue(
                  UpdateMethodEnum,
                  updateMethod,
                  UpdateMethodEnum.Online
                ),
                changed,
                link: link.trim() ? link.trim() : undefined,
                priority: parseEnumValue(
                  PriorityEnum,
                  priority,
                  PriorityEnum.Normal
                ),
                createdAt: now,
                changedAt: changed ? now : undefined,
              };

              try {
                await persistUsage([next, ...usageLocations]);
                setOrgName('');
                setLink('');
                setChanged(false);
                toast({
                  title: 'Saved',
                  description: 'Usage location saved (encrypted).',
                });
              } catch (e: any) {
                toast({
                  title: 'Failed to save',
                  description: e?.message ?? String(e),
                  variant: 'destructive',
                });
              }
            }}
          >
            Add location
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AddressDetailPage(props: { params: { id: string } }) {
  return (
    <VaultGate title="Address">
      {({ masterKeyBytes }) => (
        <AddressDetailsInner
          masterKeyBytes={masterKeyBytes}
          addressId={props.params.id}
        />
      )}
    </VaultGate>
  );
}
