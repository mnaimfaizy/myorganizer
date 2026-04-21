'use client';

import * as React from 'react';

import { getCurrentUser } from '@myorganizer/auth';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@myorganizer/web-ui';
import {
  CreditCard,
  FileDown,
  Home,
  ListChecks,
  MapPin,
  Phone,
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
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const currentUser = getCurrentUser();
  const user = {
    name: currentUser?.name ?? '',
    email: currentUser?.email ?? '',
    avatar: '',
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavUser user={user} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
