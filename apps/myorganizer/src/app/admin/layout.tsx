import {
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Toaster,
} from '@myorganizer/web-ui';

import { AdminGuard, AdminSidebar } from '@myorganizer/web-pages/admin';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <p className="text-sm font-medium">Platform Admin</p>
            </div>
          </header>
          {children}
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </AdminGuard>
  );
}
