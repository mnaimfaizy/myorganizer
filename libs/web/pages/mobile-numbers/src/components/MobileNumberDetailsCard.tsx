import { Card, CardContent, CardTitle } from '@myorganizer/web-ui';

export function MobileNumberDetailsCard(props: {
  label: string;
  mobileNumber: string;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Mobile number details</CardTitle>
      <CardContent className="mt-4 space-y-2">
        <p className="font-medium">{props.label}</p>
        <p className="text-sm text-muted-foreground break-words">
          {props.mobileNumber}
        </p>
      </CardContent>
    </Card>
  );
}
