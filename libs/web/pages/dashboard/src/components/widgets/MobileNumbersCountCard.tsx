'use client';

import {
  loadDecryptedData,
  normalizeMobileNumbers,
} from '@myorganizer/web-vault';
import { Phone } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

export function MobileNumbersCountCard({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array | null;
}) {
  return (
    <VaultStatCard
      masterKeyBytes={masterKeyBytes}
      icon={<Phone className="h-4 w-4" />}
      title="Mobile Numbers"
    >
      {(mk) => <MobileNumbersContent masterKeyBytes={mk} />}
    </VaultStatCard>
  );
}

function MobileNumbersContent({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array;
}) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes,
      type: 'mobileNumbers',
      defaultValue: [],
    })
      .then((raw) => {
        const { value } = normalizeMobileNumbers(raw);
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
        saved {count === 1 ? 'number' : 'numbers'}
      </p>
    </div>
  );
}
