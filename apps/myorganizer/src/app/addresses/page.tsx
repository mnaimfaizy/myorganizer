'use client';

import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
  Label,
  useToast,
} from '@myorganizer/web-ui';
import { useEffect, useMemo, useState } from 'react';
import VaultGate from '../../components/vault-gate';
import { loadDecryptedData, saveEncryptedData } from '../../lib/vault/vault';

type AddressItem = {
  id: string;
  label: string; // Home / Office / etc.
  address: string;
  createdAt: string;
};

function randomId(): string {
  return crypto.randomUUID();
}

function AddressesInner(props: { masterKeyBytes: Uint8Array }) {
  const { toast } = useToast();

  const [items, setItems] = useState<AddressItem[]>([]);
  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');

  useEffect(() => {
    loadDecryptedData<AddressItem[]>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'addresses',
      defaultValue: [],
    })
      .then(setItems)
      .catch(() => {
        toast({
          title: 'Failed to load addresses',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      });
  }, [props.masterKeyBytes, toast]);

  const canAdd = useMemo(
    () => label.trim().length > 0 && address.trim().length > 0,
    [label, address]
  );

  async function persist(next: AddressItem[]) {
    setItems(next);
    try {
      await saveEncryptedData({
        masterKeyBytes: props.masterKeyBytes,
        type: 'addresses',
        value: next,
      });
    } catch (e: any) {
      toast({
        title: 'Failed to save',
        description: e?.message ?? String(e),
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Card className="p-4">
        <CardTitle className="text-lg">Add address</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addr-label">Label</Label>
            <Input
              id="addr-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Home / Office"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addr-address">Address</Label>
            <Input
              id="addr-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city, postal code"
            />
          </div>

          <Button
            disabled={!canAdd}
            onClick={async () => {
              const nextItem: AddressItem = {
                id: randomId(),
                label: label.trim(),
                address: address.trim(),
                createdAt: new Date().toISOString(),
              };
              await persist([nextItem, ...items]);
              setAddress('');
              toast({
                title: 'Saved',
                description: 'Address saved (encrypted).',
              });
            }}
          >
            Add
          </Button>
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardTitle className="text-lg">Your addresses</CardTitle>
        <CardContent className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No addresses yet.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.label}</p>
                  <p className="text-sm text-muted-foreground break-words">
                    {item.address}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const next = items.filter((x) => x.id !== item.id);
                    await persist(next);
                    toast({
                      title: 'Deleted',
                      description: 'Address removed.',
                    });
                  }}
                >
                  Delete
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AddressesPage() {
  return (
    <VaultGate title="Addresses">
      {({ masterKeyBytes }) => (
        <AddressesInner masterKeyBytes={masterKeyBytes} />
      )}
    </VaultGate>
  );
}
