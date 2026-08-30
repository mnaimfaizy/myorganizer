'use client';

import { normalizeAddresses, type VaultHandle } from '@myorganizer/web-vault';
import { useLocalVaultRevision } from '@myorganizer/web-vault-ui';
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

interface AddressesCountCardProps {
  handle: VaultHandle | null;
}

export function AddressesCountCard({ handle }: AddressesCountCardProps) {
  return (
    <VaultStatCard
      handle={handle}
      icon={<MapPin className="h-4 w-4" />}
      title="Addresses"
    >
      {(h) => <AddressesContent handle={h} />}
    </VaultStatCard>
  );
}

interface AddressesContentProps {
  handle: VaultHandle;
}

function AddressesContent({ handle }: AddressesContentProps) {
  const [count, setCount] = useState<number | null>(null);

  // Read-only, so there is no overwrite to prevent here — but a dashboard
  // still showing the count from before convergence is the same staleness
  // wearing a quieter face (#587).
  const revision = useLocalVaultRevision();

  useEffect(() => {
    // Cancellation matters now that this effect re-fires on every convergence:
    // without it, an earlier read resolving late can put stale records back
    // over the ones a later read just applied.
    let isActive = true;

    handle
      .loadDecryptedData<unknown>({
        type: 'addresses',
        defaultValue: [],
      })
      .then((raw) => {
        const { value } = normalizeAddresses(raw);
        if (isActive) setCount(value.length);
      })
      .catch(() => {
        if (isActive) setCount(0);
      });

    return () => {
      isActive = false;
    };
  }, [handle, revision]);

  if (count === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs text-muted-foreground">
        saved {count === 1 ? 'address' : 'addresses'}
      </p>
    </div>
  );
}
