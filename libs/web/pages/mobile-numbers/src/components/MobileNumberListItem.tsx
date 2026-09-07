import { MobileNumberRecord } from '@myorganizer/core';
import { Badge, Button } from '@myorganizer/web-ui';
import { Smartphone, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback } from 'react';
import { formatMobileNumber } from '../utils/formatMobileNumber';

interface MobileNumberListItemProps {
  item: MobileNumberRecord;
  onRequestDelete: (item: MobileNumberRecord) => void | Promise<void>;
}

export function MobileNumberListItem({
  item,
  onRequestDelete,
}: MobileNumberListItemProps) {
  const usageCount = item.usageLocations.length;

  const handleDeleteClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onRequestDelete(item);
    },
    [onRequestDelete, item],
  );

  return (
    <div className="group relative border rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:border-primary/50 bg-card">
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/dashboard/mobile-numbers/${item.id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                  {item.label}
                </h3>
                {usageCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {usageCount} {usageCount === 1 ? 'location' : 'locations'}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground break-words font-mono">
                {formatMobileNumber(item)}
              </p>
              {usageCount === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No usage locations yet
                </p>
              )}
            </div>
          </div>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${item.label}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDeleteClick}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
