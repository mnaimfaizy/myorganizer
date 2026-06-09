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
      {({ masterKeyBytes }) => (
        <GroceriesListDetailClient
          listId={listId}
          masterKeyBytes={masterKeyBytes}
        />
      )}
    </VaultGate>
  );
}
