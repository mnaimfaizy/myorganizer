'use client';

import { VaultGate } from '@myorganizer/web-vault-ui';

import { GroceriesListDetailClient } from './GroceriesListDetailClient';

interface GroceriesListDetailPageProps {
  listId: string;
}

export function GroceriesListDetailPage({
  listId,
}: GroceriesListDetailPageProps) {
  return (
    <VaultGate title="Grocery List">
      {({ handle }) => (
        <GroceriesListDetailClient listId={listId} handle={handle!} />
      )}
    </VaultGate>
  );
}
