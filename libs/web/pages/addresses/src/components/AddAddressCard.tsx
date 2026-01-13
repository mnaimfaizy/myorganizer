import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
  Label,
} from '@myorganizer/web-ui';
import { ChangeEvent } from 'react';

export function AddAddressCard(props: {
  label: string;
  address: string;
  canAdd: boolean;
  onLabelChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onAdd: () => void | Promise<void>;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Add address</CardTitle>
      <CardContent className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="addr-label">Label</Label>
          <Input
            id="addr-label"
            value={props.label}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onLabelChange(e.target.value)
            }
            placeholder="Home / Office"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="addr-address">Address</Label>
          <Input
            id="addr-address"
            value={props.address}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onAddressChange(e.target.value)
            }
            placeholder="Street, city, postal code"
          />
        </div>

        <Button disabled={!props.canAdd} onClick={props.onAdd}>
          Add
        </Button>
      </CardContent>
    </Card>
  );
}
