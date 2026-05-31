import { AddressRecord } from '@myorganizer/core';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
} from '@myorganizer/web-ui';
import { MapPinned, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatAddress } from '../utils/formatAddress';
import { AddressListItem } from './AddressListItem';

export function AddressListCard(props: {
  items: AddressRecord[];
  onAddAddress: () => void;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      total: props.items.length,
      current: props.items.filter((item) => item.status === 'current').length,
      old: props.items.filter((item) => item.status === 'old').length,
    }),
    [props.items],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return props.items;

    return props.items.filter((item) => {
      const searchableValues = [item.label, item.country, formatAddress(item)];

      return searchableValues.some(
        (value) =>
          typeof value === 'string' &&
          value.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [props.items, query]);

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-xl font-semibold">
            Your addresses
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{counts.total} total</Badge>
            <Badge variant="outline">{counts.current} current</Badge>
            <Badge variant="outline">{counts.old} old</Badge>
          </div>
        </div>
        <Button onClick={props.onAddAddress} className="gap-2">
          <Plus className="h-4 w-4" />
          Add address
        </Button>
      </div>

      <CardContent className="space-y-4 p-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by label, address, or country"
            className="pl-9"
          />
        </div>

        {props.items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MapPinned className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">No addresses yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Add your first private address, then track the organisations where
              it is used.
            </p>
            <Button onClick={props.onAddAddress} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Add address
            </Button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No addresses match your search.
          </div>
        ) : (
          visibleItems.map((item) => (
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
