import { AddressRecord } from '@myorganizer/core';
import { AlertTriangle } from 'lucide-react';

import { formatAddress } from '../utils/formatAddress';

interface AddressDuplicateWarningProps {
  duplicateAddress: AddressRecord | null;
  acknowledged: boolean;
}

export function AddressDuplicateWarning(props: AddressDuplicateWarningProps) {
  const { duplicateAddress, acknowledged } = props;

  if (!duplicateAddress) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5" />
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            This looks like an existing address.
          </p>
          <p className="text-sm">
            {duplicateAddress.label}: {formatAddress(duplicateAddress)}
          </p>
          {acknowledged && (
            <p className="text-sm">
              Select save again to keep this as a separate address.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
