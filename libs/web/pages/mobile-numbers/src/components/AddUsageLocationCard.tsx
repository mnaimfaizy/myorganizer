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
    <Card className="p-6 shadow-sm border-2">
      <CardTitle className="text-xl font-semibold mb-6">
        Add location where used
      </CardTitle>
      <CardContent className="space-y-6 p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="usage-org-name" className="text-sm font-medium">
              Organisation Name
            </Label>
            <Input
              id="usage-org-name"
              value={props.orgName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onOrgNameChange(e.target.value)
              }
              placeholder="ATO / Comm Bank / Gmail"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usage-org-type" className="text-sm font-medium">
              Organisation Type
            </Label>
            <Combobox
              id="usage-org-type"
              value={props.orgType}
              onValueChange={props.onOrgTypeChange}
              options={props.orgTypeOptions}
              placeholder="Government"
              searchPlaceholder="Search organisation types..."
              emptyText="No organisation types found."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="usage-priority" className="text-sm font-medium">
              Priority
            </Label>
            <Select
              value={props.priority}
              onValueChange={props.onPriorityChange}
            >
              <SelectTrigger id="usage-priority" className="h-11">
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
            <Label
              htmlFor="usage-update-method"
              className="text-sm font-medium"
            >
              Update method
            </Label>
            <Combobox
              id="usage-update-method"
              value={props.updateMethod}
              onValueChange={props.onUpdateMethodChange}
              options={props.updateMethodOptions}
              placeholder="Online"
              searchPlaceholder="Search update methods..."
              emptyText="No update methods found."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="usage-link" className="text-sm font-medium">
            Link to change (optional)
          </Label>
          <Input
            id="usage-link"
            value={props.link}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onLinkChange(e.target.value)
            }
            placeholder="https://example.com"
            className="h-11"
          />
        </div>

        <div className="flex items-center gap-3 py-2">
          <Checkbox
            id="usage-changed"
            checked={props.changed}
            onCheckedChange={(v) => props.onChangedChange(Boolean(v))}
            className="h-5 w-5"
          />
          <Label
            htmlFor="usage-changed"
            className="text-sm font-medium cursor-pointer"
          >
            Already changed/updated
          </Label>
        </div>

        <div className="pt-2">
          <Button
            disabled={!props.canAddUsage}
            onClick={props.onAddUsage}
            size="lg"
            className="w-full md:w-auto px-8 h-11"
          >
            Add location
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
