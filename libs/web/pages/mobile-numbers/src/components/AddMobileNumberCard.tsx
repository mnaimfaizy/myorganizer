import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
  Label,
} from '@myorganizer/web-ui';
import { ChangeEvent } from 'react';

export function AddMobileNumberCard(props: {
  label: string;
  mobileNumber: string;
  canAdd: boolean;
  onLabelChange: (value: string) => void;
  onMobileNumberChange: (value: string) => void;
  onAdd: () => void | Promise<void>;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Add mobile number</CardTitle>
      <CardContent className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mn-label">Label</Label>
          <Input
            id="mn-label"
            value={props.label}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onLabelChange(e.target.value)
            }
            placeholder="Personal / Work"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mn-number">Mobile number</Label>
          <Input
            id="mn-number"
            value={props.mobileNumber}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onMobileNumberChange(e.target.value)
            }
            placeholder="+1 555 123 4567"
          />
        </div>

        <Button disabled={!props.canAdd} onClick={props.onAdd}>
          Add
        </Button>
      </CardContent>
    </Card>
  );
}
