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

type MobileNumberItem = {
  id: string;
  label: string; // Personal / Work / etc.
  mobileNumber: string;
  createdAt: string;
};

function randomId(): string {
  return crypto.randomUUID();
}

function MobileNumbersInner(props: { masterKeyBytes: Uint8Array }) {
  const { toast } = useToast();

  const [items, setItems] = useState<MobileNumberItem[]>([]);
  const [label, setLabel] = useState('Personal');
  const [mobileNumber, setMobileNumber] = useState('');

  useEffect(() => {
    loadDecryptedData<MobileNumberItem[]>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'mobileNumbers',
      defaultValue: [],
    })
      .then(setItems)
      .catch(() => {
        toast({
          title: 'Failed to load mobile numbers',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      });
  }, [props.masterKeyBytes, toast]);

  const canAdd = useMemo(
    () => label.trim().length > 0 && mobileNumber.trim().length > 0,
    [label, mobileNumber]
  );

  async function persist(next: MobileNumberItem[]) {
    setItems(next);
    try {
      await saveEncryptedData({
        masterKeyBytes: props.masterKeyBytes,
        type: 'mobileNumbers',
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
        <CardTitle className="text-lg">Add mobile number</CardTitle>
        <CardContent className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mn-label">Label</Label>
            <Input
              id="mn-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Personal / Work"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mn-number">Mobile number</Label>
            <Input
              id="mn-number"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="+1 555 123 4567"
            />
          </div>

          <Button
            disabled={!canAdd}
            onClick={async () => {
              const nextItem: MobileNumberItem = {
                id: randomId(),
                label: label.trim(),
                mobileNumber: mobileNumber.trim(),
                createdAt: new Date().toISOString(),
              };
              await persist([nextItem, ...items]);
              setMobileNumber('');
              toast({
                title: 'Saved',
                description: 'Mobile number saved (encrypted).',
              });
            }}
          >
            Add
          </Button>
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardTitle className="text-lg">Your mobile numbers</CardTitle>
        <CardContent className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No mobile numbers yet.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.label}</p>
                  <p className="text-sm text-muted-foreground break-words">
                    {item.mobileNumber}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const next = items.filter((x) => x.id !== item.id);
                    await persist(next);
                    toast({
                      title: 'Deleted',
                      description: 'Mobile number removed.',
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

export default function MobileNumbersPage() {
  return (
    <VaultGate title="Mobile Numbers">
      {({ masterKeyBytes }) => (
        <MobileNumbersInner masterKeyBytes={masterKeyBytes} />
      )}
    </VaultGate>
  );
}
