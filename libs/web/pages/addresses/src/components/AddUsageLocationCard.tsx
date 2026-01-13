import { PriorityEnum } from '@myorganizer/core';
import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Checkbox,
  Combobox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorganizer/web-ui';
import { ChangeEvent } from 'react';

import { enumOptions, titleCase } from '../utils/enumUtils';

export type SelectOption = { value: string; label: string };

export function AddUsageLocationCard(props: {
  orgName: string;
  orgType: string;
  updateMethod: string;
  priority: string;
  link: string;
  changed: boolean;
  canAddUsage: boolean;
  orgTypeOptions: SelectOption[];
  updateMethodOptions: SelectOption[];
  onOrgNameChange: (value: string) => void;
  onOrgTypeChange: (value: string) => void;
  onUpdateMethodChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onLinkChange: (value: string) => void;
  onChangedChange: (value: boolean) => void;
  onAddUsage: () => void | Promise<void>;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Add location where used</CardTitle>
      <CardContent className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="usage-org-name">Organisation name</Label>
          <Input
            id="usage-org-name"
            value={props.orgName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onOrgNameChange(e.target.value)
            }
            placeholder="ATO / Commbank / School"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="usage-org-type">Organisation type</Label>
          <Combobox
            id="usage-org-type"
            value={props.orgType}
            onValueChange={props.onOrgTypeChange}
            options={props.orgTypeOptions}
            placeholder="government / insurance / school"
            searchPlaceholder="Search organisation types..."
            emptyText="No organisation types found."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="usage-update-method">Update method</Label>
          <Combobox
            id="usage-update-method"
            value={props.updateMethod}
            onValueChange={props.onUpdateMethodChange}
            options={props.updateMethodOptions}
            placeholder="online / inPerson / phone / mail"
            searchPlaceholder="Search update methods..."
            emptyText="No update methods found."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="usage-priority">Priority</Label>
          <Select value={props.priority} onValueChange={props.onPriorityChange}>
            <SelectTrigger id="usage-priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {enumOptions(PriorityEnum).map((v) => (
                <SelectItem key={v} value={v}>
                  {titleCase(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="usage-link">Link to change (optional)</Label>
          <Input
            id="usage-link"
            value={props.link}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onLinkChange(e.target.value)
            }
            placeholder="https://example.com"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="usage-changed"
            checked={props.changed}
            onCheckedChange={(v) => props.onChangedChange(Boolean(v))}
          />
          <Label htmlFor="usage-changed">Already changed/updated</Label>
        </div>

        <Button disabled={!props.canAddUsage} onClick={props.onAddUsage}>
          Add location
        </Button>
      </CardContent>
    </Card>
  );
}
