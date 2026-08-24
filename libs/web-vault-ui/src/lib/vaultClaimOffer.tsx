'use client';

import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Checkbox,
  Input,
  Label,
  useToast,
} from '@myorganizer/web-ui';
import { useCallback, useState } from 'react';

import {
  type VaultHandle,
  VaultSecretMismatchError,
} from '@myorganizer/web-vault';

export type VaultClaimOfferProps = {
  /** The signed-in User's Vault Handle. `null` when nobody is signed in. */
  handle: VaultHandle | null;
  /** Called after a successful Vault Claim, with the bound Master Key. */
  onClaimed: (result: { masterKeyBytes: Uint8Array }) => void;
  /**
   * The escape. Rendered only when provided: the vault gate offers a way past
   * the offer, the vault page has nothing to escape from.
   */
  onDecline?: () => void;
};

export function VaultClaimOffer({
  handle,
  onClaimed,
  onDecline,
}: VaultClaimOfferProps) {
  const { toast } = useToast();
  const [passphrase, setPassphrase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replaceAcknowledged, setReplaceAcknowledged] = useState(false);

  const vaultStatus = handle?.vaultStatus() ?? 'absent';
  const isAlreadyOwned = vaultStatus === 'owned';

  const handleClaim = useCallback(async () => {
    if (!handle) {
      toast({
        title: "Can't claim this vault",
        description: 'Sign in to claim a vault.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await handle.claimUnclaimedLocalVault({ passphrase });
      onClaimed(result);
      toast({
        title: 'Vault claimed',
        description:
          'This vault is yours now, and it is unlocked for this session.',
      });
    } catch (e: unknown) {
      if (e instanceof VaultSecretMismatchError) {
        toast({
          title: "That passphrase didn't unlock this vault",
          description:
            'The passphrase does not match this vault. Nothing on this device was changed.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: "Can't claim this vault",
          description:
            'Something went wrong. Nothing on this device was changed.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [handle, passphrase, onClaimed, toast]);

  return (
    <Card className="p-4">
      <CardTitle className="text-lg">
        A vault is already on this device
      </CardTitle>
      <CardContent className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          It was saved here before vaults were kept per account, so we cannot
          tell whose it is. If it is yours, unlock it — that is what proves it,
          and it becomes your vault on this device.
        </p>

        <div className="space-y-2">
          <Label htmlFor="claim-passphrase">Encryption passphrase</Label>
          <Input
            id="claim-passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {isAlreadyOwned && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="space-y-3">
              <p>
                You already have a vault on this device. Claiming this one
                replaces it — export yours first if it holds anything you need.
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="replace-acknowledge"
                  checked={replaceAcknowledged}
                  onCheckedChange={(checked) =>
                    setReplaceAcknowledged(checked === true)
                  }
                />
                <Label
                  htmlFor="replace-acknowledge"
                  className="text-sm font-normal"
                >
                  Replace the vault currently saved for my account on this
                  device
                </Label>
              </div>
            </div>
          </div>
        )}

        <Button
          type="button"
          disabled={
            !passphrase ||
            isSubmitting ||
            (isAlreadyOwned && !replaceAcknowledged)
          }
          onClick={handleClaim}
        >
          {isAlreadyOwned ? 'Unlock and replace my vault' : 'Unlock this vault'}
        </Button>

        {onDecline && (
          <>
            <div className="border-t" />
            <div className="space-y-2">
              <Button type="button" variant="ghost" onClick={onDecline}>
                This isn't my vault
              </Button>
              <p className="text-xs text-muted-foreground">
                We will leave it exactly where it is and set up a new vault for
                you.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
