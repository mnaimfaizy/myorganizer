'use client';

import { UseFormReturn } from 'react-hook-form';

import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
} from '@myorganizer/web-ui';
import {
  ServerReachabilityNotice,
  useServerReachability,
} from '@myorganizer/web-vault-ui';
import type { MintedRecoveryKey } from '@myorganizer/web-vault';

import type { RotationFormInput } from './RecoveryKeyRotationCard';

interface RecoveryKeyMintedSectionProps {
  mintedKey: MintedRecoveryKey;
  form: UseFormReturn<RotationFormInput>;
  disabledState: 'signed-out' | 'no-local-vault' | 'locked' | 'enabled';
  rotating: boolean;
  onDownload: () => void;
  onCopy: () => Promise<void>;
  onCancel: () => void;
  onRotate: () => Promise<void>;
}

export function RecoveryKeyMintedSection({
  mintedKey,
  form,
  disabledState,
  rotating,
  onDownload,
  onCopy,
  onCancel,
  onRotate,
}: RecoveryKeyMintedSectionProps) {
  const confirmRecoveryKey = form.watch('confirmRecoveryKey');
  const isConfirmMatched = confirmRecoveryKey === mintedKey;

  // useServerReachability lives here because this component mounts only when
  // a recovery key is minted. That mount/unmount lifetime is the probe's
  // lifetime — it probes on mount and refreshes on window focus. Hoisting to
  // RecoveryKeyRotationCard would fire a network request for every User who
  // visits vault settings, the vast majority of whom never rotate.
  const { reachability, recheck } = useServerReachability();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="recovery-key-rotation-key-display">
          Recovery key (save this)
        </Label>
        <Input
          id="recovery-key-rotation-key-display"
          readOnly
          value={mintedKey}
          data-testid="recovery-key-rotation-key"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            data-testid="recovery-key-rotation-download"
            onClick={onDownload}
          >
            Download
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-testid="recovery-key-rotation-copy"
            onClick={onCopy}
          >
            Copy
          </Button>
        </div>
      </div>

      <FormField
        control={form.control}
        name="confirmRecoveryKey"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm you have the recovery key</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="text"
                data-testid="recovery-key-rotation-confirm"
                placeholder="Paste the recovery key shown above"
                disabled={disabledState !== 'enabled'}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* ServerReachabilityNotice is shown, never gated on. The "Rotate recovery
      key" button remains enabled even if the server is unreachable, because
      the local rotation is correct to perform regardless of network state. */}
      <ServerReachabilityNotice
        reachability={reachability}
        onRecheck={recheck}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="recovery-key-rotation-cancel"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          data-testid="recovery-key-rotation-submit"
          disabled={
            disabledState !== 'enabled' || !isConfirmMatched || rotating
          }
          onClick={onRotate}
        >
          {rotating ? 'Rotating…' : 'Rotate recovery key'}
        </Button>
      </div>
    </div>
  );
}
