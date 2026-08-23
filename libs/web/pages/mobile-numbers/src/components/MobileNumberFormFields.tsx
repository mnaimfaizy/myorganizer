import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorganizer/web-ui';
import { ChangeEvent, useCallback } from 'react';
import { COUNTRY_CALLING_CODES } from '../data/countryCodes';

export interface MobileNumberFormFieldsProps {
  label: string;
  countryCode: string;
  phoneNumber: string;
  fieldErrors?: {
    label?: string;
    countryCode?: string;
    phoneNumber?: string;
  };
  onLabelChange: (value: string) => void;
  onCountryCodeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
}

export function MobileNumberFormFields(props: MobileNumberFormFieldsProps) {
  const {
    label,
    countryCode,
    phoneNumber,
    fieldErrors,
    onLabelChange,
    onCountryCodeChange,
    onPhoneNumberChange,
  } = props;

  const handleLabelChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onLabelChange(e.target.value);
    },
    [onLabelChange],
  );

  const handlePhoneNumberChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onPhoneNumberChange(e.target.value);
    },
    [onPhoneNumberChange],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="mobile-label" className="text-sm font-medium">
          Label
        </Label>
        <Input
          id="mobile-label"
          value={label}
          onChange={handleLabelChange}
          placeholder="Personal"
          className="h-11"
        />
        {fieldErrors?.label && (
          <p className="text-sm font-medium text-destructive">
            {fieldErrors.label}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="mobile-country-code" className="text-sm font-medium">
            Country Code
          </Label>
          <Select value={countryCode} onValueChange={onCountryCodeChange}>
            <SelectTrigger id="mobile-country-code" className="h-11">
              <SelectValue placeholder="Select country code" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CALLING_CODES.map((c) => (
                <SelectItem key={`${c.code}-${c.country}`} value={c.code}>
                  {c.flag} {c.country} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors?.countryCode && (
            <p className="text-sm font-medium text-destructive">
              {fieldErrors.countryCode}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile-phone-number" className="text-sm font-medium">
            Phone Number
          </Label>
          <Input
            id="mobile-phone-number"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            placeholder="555 123 4567"
            className="h-11"
          />
          {fieldErrors?.phoneNumber && (
            <p className="text-sm font-medium text-destructive">
              {fieldErrors.phoneNumber}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
