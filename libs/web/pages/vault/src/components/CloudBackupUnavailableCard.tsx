import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@myorganizer/web-ui';

interface CloudBackupUnavailableCardProps {
  reason: string;
}

export function CloudBackupUnavailableCard({
  reason,
}: CloudBackupUnavailableCardProps) {
  return (
    <Card data-testid="cloud-backup-unavailable">
      <CardHeader>
        <CardTitle>Encrypted cloud backup</CardTitle>
        <CardDescription>{reason}</CardDescription>
      </CardHeader>
    </Card>
  );
}
