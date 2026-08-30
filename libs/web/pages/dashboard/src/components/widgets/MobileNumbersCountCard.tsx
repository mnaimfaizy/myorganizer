'use client';

import {
  normalizeMobileNumbers,
  type VaultHandle,
} from '@myorganizer/web-vault';
import { useLocalVaultRevision } from '@myorganizer/web-vault-ui';
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
        type: 'mobileNumbers',
        defaultValue: [],
      })
      .then((raw) => {
        const { value } = normalizeMobileNumbers(raw);
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
        saved {count === 1 ? 'number' : 'numbers'}
      </p>
    </div>
  );
}
