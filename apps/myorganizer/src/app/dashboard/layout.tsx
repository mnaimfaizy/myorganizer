import {
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Toaster,
} from '@myorganizer/web-ui';

import {
  DashboardGuard,
  DashboardSidebar,
  DynamicBreadcrumb,
} from '@myorganizer/web-pages/dashboard';

import {
  SyncStatusWidget,
  VaultMetaConvergeRunner,
  VaultPullRunner,
  VaultReconcileRunner,
  VaultSessionProvider,
} from '@myorganizer/web-vault-ui';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardGuard>
      <SidebarProvider>
        <VaultSessionProvider>
          <VaultReconcileRunner />
          {/*
           * Mounted beside the reconcile runner, not inside it. Vault Meta
           * converges on its own terms and cannot gate Vault Blob merging
           * (ADR 0057), so a passphrase changed on another device raises its
           * own prompt while every blob keeps merging normally.
           */}
          <VaultMetaConvergeRunner />
          <VaultPullRunner />
          <DashboardSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <DynamicBreadcrumb />
              </div>
              <div className="px-4">
                <SyncStatusWidget />
              </div>
            </header>
            {children}
          </SidebarInset>
          <Toaster />
        </VaultSessionProvider>
      </SidebarProvider>
    </DashboardGuard>
  );
}
