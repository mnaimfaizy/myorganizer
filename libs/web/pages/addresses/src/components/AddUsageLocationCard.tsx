import { Button, Card, CardContent, CardTitle } from '@myorganizer/web-ui';

import { UsageLocationFormFields } from './UsageLocationFormFields';

export type SelectOption = { value: string; label: string };

export interface AddUsageLocationCardProps {
  orgName: string;
  orgType: string;
  updateMethod: string;
  priority: string;
  link: string;
  changed: boolean;
  canAddUsage: boolean;
  duplicateOrganisationName?: string;
  duplicateAcknowledged?: boolean;
  fieldErrors?: {
    orgName?: string;
    link?: string;
  };
  submitLabel?: string;
  orgTypeOptions: SelectOption[];
  updateMethodOptions: SelectOption[];
  onOrgNameChange: (value: string) => void;
  onOrgTypeChange: (value: string) => void;
  onUpdateMethodChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onLinkChange: (value: string) => void;
  onChangedChange: (value: boolean) => void;
  onAddUsage: () => void | Promise<void>;
  isEditMode?: boolean;
}

export function AddUsageLocationCard(props: AddUsageLocationCardProps) {
  return (
    <Card className="p-6 shadow-sm border-2">
      <CardTitle className="text-xl font-semibold mb-6">
        {props.isEditMode ? 'Edit location' : 'Add location where used'}
      </CardTitle>
      <CardContent className="space-y-6 p-0">
        <UsageLocationFormFields
          orgName={props.orgName}
          orgType={props.orgType}
          updateMethod={props.updateMethod}
          priority={props.priority}
          link={props.link}
          changed={props.changed}
          duplicateOrganisationName={props.duplicateOrganisationName}
          duplicateAcknowledged={props.duplicateAcknowledged}
          fieldErrors={props.fieldErrors}
          orgTypeOptions={props.orgTypeOptions}
          updateMethodOptions={props.updateMethodOptions}
          onOrgNameChange={props.onOrgNameChange}
          onOrgTypeChange={props.onOrgTypeChange}
          onUpdateMethodChange={props.onUpdateMethodChange}
          onPriorityChange={props.onPriorityChange}
          onLinkChange={props.onLinkChange}
          onChangedChange={props.onChangedChange}
        />

        <div className="pt-2">
          <Button
            disabled={!props.canAddUsage}
            onClick={props.onAddUsage}
            size="lg"
            className="w-full md:w-auto px-8 h-11"
          >
            {props.submitLabel ??
              (props.isEditMode ? 'Update location' : 'Add location')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
