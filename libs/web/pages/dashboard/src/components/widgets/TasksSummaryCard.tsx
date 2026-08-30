'use client';

import { normalizeTasks, type VaultHandle } from '@myorganizer/web-vault';
import { useLocalVaultRevision } from '@myorganizer/web-vault-ui';
import { CheckSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

import { VaultStatCard } from './VaultStatCard';

interface TasksSummaryCardProps {
  handle: VaultHandle | null;
}

export function TasksSummaryCard({ handle }: TasksSummaryCardProps) {
  return (
    <VaultStatCard
      handle={handle}
      icon={<CheckSquare className="h-4 w-4" />}
      title="Tasks"
    >
      {(h) => <TasksSummaryContent handle={h} />}
    </VaultStatCard>
  );
}

interface TasksSummaryContentProps {
  handle: VaultHandle;
}

function TasksSummaryContent({ handle }: TasksSummaryContentProps) {
  const [summary, setSummary] = useState<{
    counts: Record<string, number>;
    total: number;
  } | null>(null);

  // Read-only, so there is no overwrite to prevent here — but a dashboard
  // still showing the count from before convergence is the same staleness
  // wearing a quieter face (#587).
  const revision = useLocalVaultRevision();

  useEffect(() => {
    // Cancellation matters now that this effect re-fires on every convergence:
    // without it, an earlier read resolving late can put a stale count back
    // over the one a later read just applied.
    let isActive = true;

    handle
      .loadDecryptedData<unknown>({
        type: 'tasks',
        defaultValue: [],
      })
      .then((raw) => {
        if (!isActive) return;
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
      .catch(() => {
        if (!isActive) return;
        setSummary({
          counts: {
            pending: 0,
            in_progress: 0,
            done: 0,
            cancelled: 0,
            blocked: 0,
          },
          total: 0,
        });
      });

    return () => {
      isActive = false;
    };
  }, [handle, revision]);

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
