'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@myorganizer/web-ui';
import type { VaultHandle } from '@myorganizer/web-vault';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

export type VaultStatCardProps = {
  handle: VaultHandle | null;
  icon: ReactNode;
  title: string;
  children: (handle: VaultHandle) => ReactNode;
  className?: string;
};

export function VaultStatCard({
  handle,
  icon,
  title,
  children,
  className,
}: VaultStatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {handle?.isUnlocked ? (
          children(handle)
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Lock className="h-4 w-4" />
            <span>Unlock vault to view</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
