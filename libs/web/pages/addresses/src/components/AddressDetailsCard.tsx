import { Card, CardContent, CardTitle } from '@myorganizer/web-ui';

export function AddressDetailsCard(props: {
  label: string;
  address: string;
  status: string;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Address details</CardTitle>
      <CardContent className="mt-4 space-y-2">
        <p className="font-medium">{props.label}</p>
        <p className="text-sm text-muted-foreground break-words">
          {props.address}
        </p>
        <p className="text-xs text-muted-foreground">Status: {props.status}</p>
      </CardContent>
    </Card>
  );
}
