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
