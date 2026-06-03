'use client';

import type { GroceryList } from '@myorganizer/core';
import {
  loadDecryptedData,
  normalizeGroceries,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useEffect, useState } from 'react';

interface GroceriesInnerProps {
  masterKeyBytes: Uint8Array;
}

function GroceriesInner({ masterKeyBytes }: GroceriesInnerProps) {
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes,
      type: 'groceries',
      defaultValue: [],
    }).then(async (raw) => {
      const normalized = normalizeGroceries(raw);
      setLists(normalized.value);
      if (normalized.changed) {
        await saveEncryptedData({
          masterKeyBytes,
          type: 'groceries',
          value: normalized.value,
        });
      }
      setLoading(false);
    });
  }, [masterKeyBytes]);

  if (loading) return <p>Loading groceries...</p>;

  // TODO: Replace with full list management UI (tracked in separate issue)
  return (
    <div>
      <h1>Grocery Lists</h1>
      {lists.length === 0 && <p>No lists yet. Create one to get started.</p>}
    </div>
  );
}

export function GroceriesPage() {
  return (
    <VaultGate title="Groceries">
      {(ctx) => <GroceriesInner masterKeyBytes={ctx.masterKeyBytes} />}
    </VaultGate>
  );
}
