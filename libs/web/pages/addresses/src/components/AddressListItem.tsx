import { AddressRecord } from '@myorganizer/core';
import { Badge, Button } from '@myorganizer/web-ui';
import { ArrowRight, MapPin, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatAddress } from '../utils/formatAddress';

export function AddressListItem(props: {
  item: AddressRecord;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const usageCount = props.item.usageLocations.length;

  return (
    <div className="group relative rounded-lg border bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/dashboard/addresses/${props.item.id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="truncate text-base font-semibold transition-colors group-hover:text-primary">
                  {props.item.label}
                </h3>
                {usageCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {usageCount} {usageCount === 1 ? 'location' : 'locations'}
                  </Badge>
                )}
              </div>
              <p className="mb-2 text-sm text-muted-foreground wrap-break-word">
                {formatAddress(props.item)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    props.item.status === 'current' ? 'default' : 'outline'
                  }
                  className="text-xs"
                >
                  {props.item.status}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  Open
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        </Link>

        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${props.item.label}`}
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.preventDefault();
            props.onDelete(props.item.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
