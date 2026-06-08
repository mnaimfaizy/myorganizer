'use client';

import { loadDecryptedData, normalizeTasks } from '@myorganizer/web-vault';
import { CheckSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

export function TasksSummaryCard({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array | null;
}) {
  return (
    <VaultStatCard
      masterKeyBytes={masterKeyBytes}
      icon={<CheckSquare className="h-4 w-4" />}
      title="Tasks"
    >
      {(mk) => <TasksSummaryContent masterKeyBytes={mk} />}
    </VaultStatCard>
  );
}

function TasksSummaryContent({
  masterKeyBytes,
}: {
  masterKeyBytes: Uint8Array;
}) {
  const [summary, setSummary] = useState<{
    counts: Record<string, number>;
    total: number;
  } | null>(null);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes,
      type: 'tasks',
      defaultValue: [],
    })
      .then((raw) => {
        const { value } = normalizeTasks(raw);
        const nonArchivedTasks = value.filter((task) => !task.archived);

        const counts = {
          pending: 0,
          in_progress: 0,
          done: 0,
          cancelled: 0,
          blocked: 0,
        };

        nonArchivedTasks.forEach((task) => {
          counts[task.status]++;
        });

        setSummary({
          counts,
          total: nonArchivedTasks.length,
        });
      })
      .catch(() =>
        setSummary({
          counts: {
            pending: 0,
            in_progress: 0,
            done: 0,
            cancelled: 0,
            blocked: 0,
          },
          total: 0,
        }),
      );
  }, [masterKeyBytes]);

  if (summary === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const { counts, total } = summary;

  const parts: string[] = [];
  if (counts.pending > 0) parts.push(`${counts.pending} pending`);
  if (counts.in_progress > 0) parts.push(`${counts.in_progress} in progress`);
  if (counts.done > 0) parts.push(`${counts.done} done`);
  if (counts.cancelled > 0) parts.push(`${counts.cancelled} cancelled`);
  if (counts.blocked > 0) parts.push(`${counts.blocked} blocked`);

  const displayText = parts.length > 0 ? parts.join(' · ') : 'no tasks';

  return (
    <div>
      <p className="text-2xl font-bold">{total}</p>
      <p className="text-xs text-muted-foreground">{displayText}</p>
    </div>
  );
}
