import {
  Button,
  Card,
  CardContent,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorganizer/web-ui';
import { ChangeEvent } from 'react';
import { COUNTRY_CALLING_CODES } from '../data/countryCodes';

export function AddMobileNumberCard(props: {
  label: string;
  countryCode: string;
  phoneNumber: string;
  canAdd: boolean;
  onLabelChange: (value: string) => void;
  onCountryCodeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  onAdd: () => void | Promise<void>;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Add mobile number</CardTitle>
      <CardContent className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mn-label">Label *</Label>
          <Input
            id="mn-label"
            value={props.label}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onLabelChange(e.target.value)
            }
            placeholder="Personal / Work"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="mn-country-code">Country Code *</Label>
            <Select
              value={props.countryCode}
              onValueChange={props.onCountryCodeChange}
            >
              <SelectTrigger id="mn-country-code">
                <SelectValue placeholder="Select code" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CALLING_CODES.map((country) => (
                  <SelectItem
                    key={`${country.code}-${country.country}`}
                    value={country.code}
                  >
                    {country.flag} {country.code} - {country.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="mn-number">Phone Number *</Label>
            <Input
              id="mn-number"
              type="tel"
              value={props.phoneNumber}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onPhoneNumberChange(e.target.value)
              }
              placeholder="555 123 4567"
            />
          </div>
        </div>

        <Button
          disabled={!props.canAdd}
          onClick={props.onAdd}
          className="w-full"
        >
          Add Mobile Number
        </Button>
      </CardContent>
    </Card>
  );
}
