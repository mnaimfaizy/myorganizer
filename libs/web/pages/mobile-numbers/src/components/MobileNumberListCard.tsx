import { MobileNumberRecord } from '@myorganizer/core';
import { Card, CardContent, CardTitle } from '@myorganizer/web-ui';

import { MobileNumberListItem } from './MobileNumberListItem';

export function MobileNumberListCard(props: {
  items: MobileNumberRecord[];
  onDelete: (id: string) => void | Promise<void>;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Your mobile numbers</CardTitle>
      <CardContent className="mt-4 space-y-3">
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
