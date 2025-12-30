'use client';

import * as React from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@myorganizer/web-ui';
import { FileDown, Home, ListChecks, MapPin, Phone } from 'lucide-react';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  navMain: [
    {
      title: 'Home',
      url: '/',
      icon: Home,
    },
    {
      title: 'Todos',
      url: '/todo',
      icon: ListChecks,
    },
    {
      title: 'Addresses',
      url: '/addresses',
      icon: MapPin,
    },
    {
      title: 'Mobile Numbers',
      url: '/mobile-numbers',
      icon: Phone,
    },
    {
      title: 'Vault Export/Import',
      url: '/vault-export',
      icon: FileDown,
    },
  ],
};
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavUser user={data.user} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
