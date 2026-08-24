'use client';

import { normalizeAddresses, type VaultHandle } from '@myorganizer/web-vault';
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

  useEffect(() => {
    handle
      .loadDecryptedData<unknown>({
        type: 'addresses',
        defaultValue: [],
      })
      .then((raw) => {
        const { value } = normalizeAddresses(raw);
        setCount(value.length);
      })
      .catch(() => setCount(0));
  }, [handle]);

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
