'use client';

import { getCurrentUser } from '@myorganiser/auth';
import { useOptionalVaultSession } from '@myorganiser/web-vault-ui';
import { useMemo } from 'react';

import { AddressesCountCard } from './widgets/AddressesCountCard';
import { InstallAppCard } from './widgets/InstallAppCard';
import { MobileNumbersCountCard } from './widgets/MobileNumbersCountCard';
import { QuickActionsCard } from './widgets/QuickActionsCard';
import { RecentYouTubeCard } from './widgets/RecentYouTubeCard';
import { SubscriptionsOverviewCard } from './widgets/SubscriptionsOverviewCard';
import { TasksSummaryCard } from './widgets/TasksSummaryCard';
import { WelcomeCard } from './widgets/WelcomeCard';

export function DashboardHomeClient() {
  const user = useMemo(() => getCurrentUser(), []);
  const session = useOptionalVaultSession();
  const handle = session?.handle ?? null;

  return (
    <div className="grid auto-rows-min gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
      {/* Install prompt: full width, renders nothing once installed or dismissed */}
      <InstallAppCard />

      {/* Row 1: Welcome + Quick Actions */}
      <WelcomeCard user={user} />
      <QuickActionsCard />

      {/* Row 2: Vault stat cards */}
      <TasksSummaryCard handle={handle} />
      <SubscriptionsOverviewCard handle={handle} />
      <AddressesCountCard handle={handle} />
      <MobileNumbersCountCard handle={handle} />

      {/* Row 3: YouTube (full width) */}
      <RecentYouTubeCard />
    </div>
  );
}
