'use client';

import type { AuthUser } from '@myorganizer/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@myorganizer/web-ui';
import { User } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function WelcomeCard({ user }: { user: AuthUser | undefined }) {
  const name = user?.firstName ?? 'there';

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Welcome</CardTitle>
        <User className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">
          {getGreeting()}, {name}!
        </p>
        {user?.email && (
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        )}
      </CardContent>
    </Card>
  );
}
