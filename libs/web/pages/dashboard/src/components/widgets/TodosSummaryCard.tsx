'use client';

import { loadDecryptedData, normalizeTodos } from '@myorganizer/web-vault';
import { ListChecks } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

export function TodosSummaryCard({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array | null;
}) {
  return (
    <VaultStatCard
      masterKeyBytes={masterKeyBytes}
      icon={<ListChecks className="h-4 w-4" />}
      title="Todos"
    >
      {(mk) => <TodosSummaryContent masterKeyBytes={mk} />}
    </VaultStatCard>
  );
}

function TodosSummaryContent({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array;
}) {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes,
      type: 'todos',
      defaultValue: [],
    })
      .then((raw) => {
        const { value } = normalizeTodos(raw);
        setTotal(value.length);
      })
      .catch(() => setTotal(0));
  }, [masterKeyBytes]);

  if (total === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div>
      <p className="text-2xl font-bold">{total}</p>
      <p className="text-xs text-muted-foreground">
        {total === 1 ? 'item' : 'items'} in your list
      </p>
    </div>
  );
}
