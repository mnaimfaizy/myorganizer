'use client';

import { loadDecryptedData, normalizeAddresses } from '@myorganizer/web-vault';
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

export function AddressesCountCard({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array | null;
}) {
  return (
    <VaultStatCard
      masterKeyBytes={masterKeyBytes}
      icon={<MapPin className="h-4 w-4" />}
      title="Addresses"
    >
      {(mk) => <AddressesContent masterKeyBytes={mk} />}
    </VaultStatCard>
  );
}

function AddressesContent({ masterKeyBytes }: { masterKeyBytes: Uint8Array }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes,
      type: 'addresses',
      defaultValue: [],
    })
      .then((raw) => {
        const { value } = normalizeAddresses(raw);
        setCount(value.length);
      })
      .catch(() => setCount(0));
  }, [masterKeyBytes]);

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
