'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@myorganizer/web-ui';

interface BreadcrumbNavItem {
  label: string;
  href: string;
}

/**
 * Maps URL paths to breadcrumb labels based on the navigation structure.
 * Supports both single-level routes (/dashboard/tasks) and nested routes (/dashboard/account/vault).
 */
function getBreadcrumbItems(pathname: string): BreadcrumbNavItem[] {
  // Navigation configuration matching app-sidebar.tsx
  const routeMap: Record<string, BreadcrumbNavItem[]> = {
    '/dashboard': [{ label: 'Dashboard', href: '/dashboard' }],
    '/dashboard/tasks': [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Tasks', href: '/dashboard/tasks' },
    ],
    '/dashboard/groceries': [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Groceries', href: '/dashboard/groceries' },
    ],
    '/dashboard/addresses': [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Addresses', href: '/dashboard/addresses' },
    ],
    '/dashboard/mobile-numbers': [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Mobile Numbers', href: '/dashboard/mobile-numbers' },
    ],
    '/dashboard/subscriptions': [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Subscriptions', href: '/dashboard/subscriptions' },
    ],
    '/dashboard/youtube': [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'YouTube', href: '/dashboard/youtube' },
    ],
    '/dashboard/vault-export': [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Vault Export/Import', href: '/dashboard/vault-export' },
    ],
    '/dashboard/account/vault': [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Account', href: '/dashboard/account' },
      { label: 'Vault Settings', href: '/dashboard/account/vault' },
    ],
  };

  // Return the mapped breadcrumbs or fallback to Dashboard only for unknown routes
  return routeMap[pathname] || [{ label: 'Dashboard', href: '/dashboard' }];
}

export function DynamicBreadcrumb(): React.ReactNode {
  const pathname = usePathname();
  const breadcrumbItems = getBreadcrumbItems(pathname);

  // Should not happen, but ensures at least Dashboard is shown
  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => {
          const isLastItem = index === breadcrumbItems.length - 1;

          return (
            <React.Fragment key={item.href}>
              <BreadcrumbItem
                className={index === 0 ? 'hidden md:block' : undefined}
              >
                {isLastItem ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLastItem && (
                <BreadcrumbSeparator className="hidden md:block" />
              )}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
