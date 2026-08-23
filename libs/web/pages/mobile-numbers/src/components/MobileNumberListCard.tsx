import { MobileNumberRecord } from '@myorganizer/core';
import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';
import { Plus } from 'lucide-react';

import { MobileNumberListItem } from './MobileNumberListItem';

interface MobileNumberListCardProps {
  items: MobileNumberRecord[];
  onAddMobileNumber: () => void;
  onRequestDelete: (item: MobileNumberRecord) => void | Promise<void>;
}

export function MobileNumberListCard(props: MobileNumberListCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-5">
        <CardTitle className="text-xl font-semibold">
          Your mobile numbers
        </CardTitle>
        <Button onClick={props.onAddMobileNumber} className="gap-2">
          <Plus className="h-4 w-4" />
          Add mobile number
        </Button>
      </div>
      <CardContent className="space-y-3 p-0">
        {props.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mobile numbers yet.
          </p>
        ) : (
          props.items.map((item) => (
            <MobileNumberListItem
              key={item.id}
              item={item}
              onRequestDelete={props.onRequestDelete}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
