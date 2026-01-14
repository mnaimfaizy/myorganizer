import { MobileNumberRecord } from '@myorganizer/core';
import { Card, CardContent, CardTitle } from '@myorganizer/web-ui';

import { MobileNumberListItem } from './MobileNumberListItem';

export function MobileNumberListCard(props: {
  items: MobileNumberRecord[];
  onDelete: (id: string) => void | Promise<void>;
}) {
  return (
    <Card className="p-6">
      <CardTitle className="text-xl font-semibold mb-4">
        Your mobile numbers
      </CardTitle>
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
              onDelete={props.onDelete}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
