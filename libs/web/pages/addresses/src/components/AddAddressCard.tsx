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
import { COUNTRIES } from '../data/countries';

export function AddAddressCard(props: {
  label: string;
  propertyNumber: string;
  street: string;
  suburb: string;
  state: string;
  zipCode: string;
  country: string;
  canAdd: boolean;
  onLabelChange: (value: string) => void;
  onPropertyNumberChange: (value: string) => void;
  onStreetChange: (value: string) => void;
  onSuburbChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onZipCodeChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onAdd: () => void | Promise<void>;
}) {
  return (
    <Card className="p-4">
      <CardTitle className="text-lg">Add address</CardTitle>
      <CardContent className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="addr-label">Label *</Label>
          <Input
            id="addr-label"
            value={props.label}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              props.onLabelChange(e.target.value)
            }
            placeholder="Home / Office / Work"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="addr-property">Property Number</Label>
            <Input
              id="addr-property"
              value={props.propertyNumber}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onPropertyNumberChange(e.target.value)
              }
              placeholder="123"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addr-street">Street *</Label>
            <Input
              id="addr-street"
              value={props.street}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onStreetChange(e.target.value)
              }
              placeholder="Main Street"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="addr-suburb">Suburb/City *</Label>
            <Input
              id="addr-suburb"
              value={props.suburb}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onSuburbChange(e.target.value)
              }
              placeholder="Melbourne"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addr-state">State/Province *</Label>
            <Input
              id="addr-state"
              value={props.state}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onStateChange(e.target.value)
              }
              placeholder="VIC"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="addr-zipcode">Zip/Postal Code *</Label>
            <Input
              id="addr-zipcode"
              value={props.zipCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onZipCodeChange(e.target.value)
              }
              placeholder="3000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="addr-country">Country *</Label>
            <Select value={props.country} onValueChange={props.onCountryChange}>
              <SelectTrigger id="addr-country">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.name}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          disabled={!props.canAdd}
          onClick={props.onAdd}
          className="w-full"
        >
          Add Address
        </Button>
      </CardContent>
    </Card>
  );
}
