import { MobileNumberRecord } from '@myorganizer/core';
import { Button } from '@myorganizer/web-ui';
import Link from 'next/link';

export function MobileNumberListItem(props: {
  item: MobileNumberRecord;
  onDelete: (id: string) => void | Promise<void>;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Link
          href={`/dashboard/mobile-numbers/${props.item.id}`}
          className="font-medium truncate underline-offset-4 hover:underline"
        >
          {props.item.label}
        </Link>
        <p className="text-sm text-muted-foreground break-words">
          {props.item.mobileNumber}
        </p>
        <p className="text-xs text-muted-foreground">
          {props.item.usageLocations.length > 0
            ? `Used at ${props.item.usageLocations.length}`
            : 'No usage locations yet.'}
        </p>
      </div>

      <Button
        variant="destructive"
        onClick={() => props.onDelete(props.item.id)}
      >
        Delete
      </Button>
    </div>
  );
}
