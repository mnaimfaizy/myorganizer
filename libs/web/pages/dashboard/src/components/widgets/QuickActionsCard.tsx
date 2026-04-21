'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@myorganizer/web-ui';
import { CreditCard, ListChecks, MapPin, Phone, Zap } from 'lucide-react';
import Link from 'next/link';

const actions = [
  { label: 'Todos', href: '/dashboard/todo', icon: ListChecks },
  { label: 'Addresses', href: '/dashboard/addresses', icon: MapPin },
  {
    label: 'Subscriptions',
    href: '/dashboard/subscriptions',
    icon: CreditCard,
  },
  { label: 'Mobile Numbers', href: '/dashboard/mobile-numbers', icon: Phone },
] as const;

export function QuickActionsCard() {
  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
