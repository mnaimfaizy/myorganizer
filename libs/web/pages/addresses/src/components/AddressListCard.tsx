import { AddressRecord } from '@myorganizer/core';
import { Card, CardContent, CardTitle } from '@myorganizer/web-ui';

import { AddressListItem } from './AddressListItem';

export function AddressListCard(props: {
  items: AddressRecord[];
  onDelete: (id: string) => void | Promise<void>;
}) {
  return (
    <Card className="p-6">
      <CardTitle className="text-xl font-semibold mb-4">
        Your addresses
      </CardTitle>
      <CardContent className="space-y-3 p-0">
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
