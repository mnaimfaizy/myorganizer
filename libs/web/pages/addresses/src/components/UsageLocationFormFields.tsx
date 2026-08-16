import { PriorityEnum } from '@myorganizer/core';
import {
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
import { AlertTriangle } from 'lucide-react';
import { ChangeEvent, useCallback } from 'react';

import { enumOptions, titleCase } from '../utils/enumUtils';
import type { SelectOption } from './AddUsageLocationCard';

export interface UsageLocationFormFieldsProps {
  orgName: string;
  orgType: string;
  updateMethod: string;
  priority: string;
  link: string;
  changed: boolean;
  duplicateOrganisationName?: string;
  duplicateAcknowledged?: boolean;
  fieldErrors?: {
    orgName?: string;
    link?: string;
  };
  orgTypeOptions: SelectOption[];
  updateMethodOptions: SelectOption[];
  onOrgNameChange: (value: string) => void;
  onOrgTypeChange: (value: string) => void;
  onUpdateMethodChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onLinkChange: (value: string) => void;
  onChangedChange: (value: boolean) => void;
}

export function UsageLocationFormFields(props: UsageLocationFormFieldsProps) {
  const {
    orgName,
    orgType,
    updateMethod,
    priority,
    link,
    changed,
    duplicateOrganisationName,
    duplicateAcknowledged,
    fieldErrors,
    orgTypeOptions,
    updateMethodOptions,
    onOrgNameChange,
    onOrgTypeChange,
    onUpdateMethodChange,
    onPriorityChange,
    onLinkChange,
    onChangedChange,
  } = props;

  const handleOrgNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onOrgNameChange(e.target.value);
    },
    [onOrgNameChange],
  );

  const handleLinkChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onLinkChange(e.target.value);
    },
    [onLinkChange],
  );

  const handleChangedChange = useCallback(
    (v: boolean | 'indeterminate') => {
      onChangedChange(Boolean(v));
    },
    [onChangedChange],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="usage-org-name" className="text-sm font-medium">
            Organisation Name
          </Label>
          <Input
            id="usage-org-name"
            value={orgName}
            onChange={handleOrgNameChange}
            placeholder="ATO / Comm Bank"
            className="h-11"
          />
          {fieldErrors?.orgName && (
            <p className="text-sm font-medium text-destructive">
              {fieldErrors.orgName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="usage-org-type" className="text-sm font-medium">
            Organisation Type
          </Label>
          <Combobox
            id="usage-org-type"
            value={orgType}
            onValueChange={onOrgTypeChange}
            options={orgTypeOptions}
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
          <Select value={priority} onValueChange={onPriorityChange}>
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
            value={updateMethod}
            onValueChange={onUpdateMethodChange}
            options={updateMethodOptions}
            placeholder="Online"
            searchPlaceholder="Search update methods..."
            emptyText="No update methods found."
          />
        </div>
      </div>

      {duplicateOrganisationName && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                This organisation is already attached to this address.
              </p>
              <p className="text-sm">
                Existing entry: {duplicateOrganisationName}
              </p>
              {duplicateAcknowledged && (
                <p className="text-sm">
                  Select save again to keep this as a separate location.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="usage-link" className="text-sm font-medium">
          Link to change (optional)
        </Label>
        <Input
          id="usage-link"
          value={link}
          onChange={handleLinkChange}
          placeholder="https://example.com"
          className="h-11"
        />
        {fieldErrors?.link && (
          <p className="text-sm font-medium text-destructive">
            {fieldErrors.link}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 py-2">
        <Checkbox
          id="usage-changed"
          checked={changed}
          onCheckedChange={handleChangedChange}
          className="h-5 w-5"
        />
        <Label
          htmlFor="usage-changed"
          className="text-sm font-medium cursor-pointer"
        >
          Already changed/updated
        </Label>
      </div>
    </div>
  );
}
