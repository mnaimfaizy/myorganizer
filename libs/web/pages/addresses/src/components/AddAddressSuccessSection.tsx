'use client';

import { AddressRecord } from '@myorganizer/core';
import { Button } from '@myorganizer/web-ui';
import { CheckCircle2 } from 'lucide-react';
import { useCallback } from 'react';

import { formatAddress } from '../utils/formatAddress';

export interface AddAddressSuccessSectionProps {
  savedAddress: AddressRecord;
  onViewAddress: (id: string) => void;
  onAddLocation: (id: string) => void;
  onAddAnother: () => void;
}

export function AddAddressSuccessSection(props: AddAddressSuccessSectionProps) {
  const { savedAddress, onViewAddress, onAddLocation, onAddAnother } = props;

  const handleViewAddress = useCallback(() => {
    onViewAddress(savedAddress.id);
  }, [onViewAddress, savedAddress.id]);

  const handleAddLocation = useCallback(() => {
    onAddLocation(savedAddress.id);
  }, [onAddLocation, savedAddress.id]);

  return (
    <div className="mt-6 space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
        <div className="space-y-1">
          <h3 className="font-semibold">Address saved</h3>
          <p className="text-sm text-muted-foreground">
            {formatAddress(savedAddress)}
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" onClick={handleViewAddress}>
          View address
        </Button>
        <Button type="button" variant="outline" onClick={handleAddLocation}>
          Add usage location
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onAddAnother}
      >
        Add another address
      </Button>
    </div>
  );
}
