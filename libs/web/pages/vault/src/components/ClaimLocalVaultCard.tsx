'use client';

import { Card, CardContent } from '@myorganizer/web-ui';
import { useState } from 'react';

import {
  useOptionalVaultSession,
  VaultClaimOffer,
} from '@myorganizer/web-vault-ui';

export function ClaimLocalVaultCard() {
  const vaultSession = useOptionalVaultSession();
  const handle = vaultSession?.handle ?? null;
  const [claimed, setClaimed] = useState(false);

  const unclaimedPresent = handle?.hasUnclaimedLocalVault() ?? false;

  if (!handle || !unclaimedPresent) {
    return null;
  }

  if (claimed) {
    return (
      <Card className="p-4">
        <CardContent className="mt-4">
          <p className="text-sm text-muted-foreground">
            The vault on this device is now yours and unlocked for this session.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <VaultClaimOffer
      handle={handle}
      onClaimed={(result) => {
        vaultSession?.setMasterKeyBytes(result.masterKeyBytes);
        setClaimed(true);
      }}
    />
  );
}
