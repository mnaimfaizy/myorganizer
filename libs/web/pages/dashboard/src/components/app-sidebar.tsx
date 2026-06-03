'use client';

import * as React from 'react';

import { getCurrentUser } from '@myorganizer/auth';
import {
  AppLogo,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@myorganizer/web-ui';
import {
  CloudUpload,
  CreditCard,
  FileDown,
  Home,
  ListChecks,
  MapPin,
  Phone,
  ShoppingCart,
  Youtube,
} from 'lucide-react';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';

const navMain = [
  {
    title: 'Home',
    url: '/dashboard',
    icon: Home,
  },
  {
    title: 'Todos',
    url: '/dashboard/todo',
    icon: ListChecks,
  },
  {
    title: 'Groceries',
    url: '/dashboard/groceries',
    icon: ShoppingCart,
  },
  {
    title: 'Addresses',
    url: '/dashboard/addresses',
    icon: MapPin,
  },
  {
    title: 'Mobile Numbers',
    url: '/dashboard/mobile-numbers',
    icon: Phone,
  },
  {
    title: 'Subscriptions',
    url: '/dashboard/subscriptions',
    icon: CreditCard,
  },
  {
    title: 'YouTube',
    url: '/dashboard/youtube',
    icon: Youtube,
  },
  {
    title: 'Vault Export/Import',
    url: '/dashboard/vault-export',
    icon: FileDown,
  },
  {
    title: 'Vault Settings',
    url: '/dashboard/account/vault',
    icon: CloudUpload,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const currentUser = getCurrentUser();
  const user = {
    name: currentUser?.name ?? '',
    email: currentUser?.email ?? '',
    avatar: '',
  };
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center px-2 py-3">
          <AppLogo
            variant={state === 'collapsed' ? 'icon' : 'full'}
            height={28}
          />
        </div>
        <NavUser user={user} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
