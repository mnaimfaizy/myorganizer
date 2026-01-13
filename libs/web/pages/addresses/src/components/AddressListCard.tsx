import { AddressRecord } from '@myorganizer/core';
import { Card, CardContent, CardTitle } from '@myorganizer/web-ui';

import { AddressListItem } from './AddressListItem';

export function AddressListCard(props: {
  items: AddressRecord[];
  onDelete: (id: string) => void | Promise<void>;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Your addresses</CardTitle>
      <CardContent className="mt-4 space-y-3">
        {props.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No addresses yet.</p>
        ) : (
          props.items.map((item) => (
            <AddressListItem
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
