'use client';

import {
  normalizeMobileNumbers,
  type VaultHandle,
} from '@myorganizer/web-vault';
import { Phone } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

interface MobileNumbersCountCardProps {
  handle: VaultHandle | null;
}

export function MobileNumbersCountCard({
  handle,
}: MobileNumbersCountCardProps) {
  return (
    <VaultStatCard
      handle={handle}
      icon={<Phone className="h-4 w-4" />}
      title="Mobile Numbers"
    >
      {(h) => <MobileNumbersContent handle={h} />}
    </VaultStatCard>
  );
}

interface MobileNumbersContentProps {
  handle: VaultHandle;
}

function MobileNumbersContent({ handle }: MobileNumbersContentProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    handle
      .loadDecryptedData<unknown>({
        type: 'mobileNumbers',
        defaultValue: [],
      })
      .then((raw) => {
        const { value } = normalizeMobileNumbers(raw);
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
        saved {count === 1 ? 'number' : 'numbers'}
      </p>
    </div>
  );
}
