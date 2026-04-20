'use client';

import { getCurrentUser } from '@myorganizer/auth';
import { useOptionalVaultSession } from '@myorganizer/web-vault-ui';
import { useMemo } from 'react';

import { AddressesCountCard } from './widgets/AddressesCountCard';
import { MobileNumbersCountCard } from './widgets/MobileNumbersCountCard';
import { QuickActionsCard } from './widgets/QuickActionsCard';
import { RecentYouTubeCard } from './widgets/RecentYouTubeCard';
import { SubscriptionsOverviewCard } from './widgets/SubscriptionsOverviewCard';
import { TodosSummaryCard } from './widgets/TodosSummaryCard';
import { WelcomeCard } from './widgets/WelcomeCard';

export function DashboardHomeClient() {
  const user = useMemo(() => getCurrentUser(), []);
  const session = useOptionalVaultSession();
  const masterKeyBytes = session?.masterKeyBytes ?? null;

  return (
    <div className="grid auto-rows-min gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
      {/* Row 1: Welcome + Quick Actions */}
      <WelcomeCard user={user} />
      <QuickActionsCard />

      {/* Row 2: Vault stat cards */}
      <TodosSummaryCard masterKeyBytes={masterKeyBytes} />
      <SubscriptionsOverviewCard masterKeyBytes={masterKeyBytes} />
      <AddressesCountCard masterKeyBytes={masterKeyBytes} />
      <MobileNumbersCountCard masterKeyBytes={masterKeyBytes} />

      {/* Row 3: YouTube (full width) */}
      <RecentYouTubeCard />
    </div>
  );
}
