'use client';

import {
  Button,
  Card,
  CardContent,
  CardTitle,
} from '@myorganizer/web-ui';
import { type UseFormReturn } from 'react-hook-form';

import { EditSubscriptionGeneralSection } from './EditSubscriptionGeneralSection';
import { EditSubscriptionPlanSection } from './EditSubscriptionPlanSection';
import { EditSubscriptionScheduleSection } from './EditSubscriptionScheduleSection';
import type { EditValues } from './SubscriptionDetailPageClient';

export interface EditSubscriptionCardProps {
  form: UseFormReturn<EditValues>;
  canSave: boolean;
  onSave: () => void;
  onDelete: () => void;
}

export function EditSubscriptionCard({
  form,
  canSave,
  onSave,
  onDelete,
}: EditSubscriptionCardProps) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Edit subscription</CardTitle>
      <CardContent className="mt-4 space-y-4">
        <EditSubscriptionGeneralSection form={form} />
        <EditSubscriptionScheduleSection form={form} />
        <EditSubscriptionPlanSection form={form} />

        <div className="flex gap-2">
          <Button
            disabled={!canSave}
            onClick={onSave}
            className="flex-1"
          >
            Save
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            className="flex-1"
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
