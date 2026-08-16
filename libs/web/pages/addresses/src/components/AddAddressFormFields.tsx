'use client';

import {
  Combobox,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@myorganizer/web-ui';
import { Control } from 'react-hook-form';

import {
  ADDRESS_COUNTRY_OPTIONS,
  AddAddressFormValues,
} from '../utils/addressForm';

export interface AddAddressFormFieldsProps {
  control: Control<AddAddressFormValues>;
}

export function AddAddressFormFields(props: AddAddressFormFieldsProps) {
  const { control } = props;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl>
                <Input placeholder="Home / Office / Work" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="countryCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="addr-country">Country</FormLabel>
              <Combobox
                id="addr-country"
                value={field.value}
                onValueChange={field.onChange}
                options={ADDRESS_COUNTRY_OPTIONS}
                placeholder="Select a country"
                searchPlaceholder="Search countries..."
                emptyText="No countries found."
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="propertyNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Property number</FormLabel>
              <FormControl>
                <Input
                  id="addr-property"
                  placeholder="221B"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="street"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Street</FormLabel>
              <FormControl>
                <Input
                  id="addr-street"
                  placeholder="Baker Street"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="suburb"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Suburb or city</FormLabel>
              <FormControl>
                <Input
                  id="addr-suburb"
                  placeholder="London"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State or province</FormLabel>
              <FormControl>
                <Input
                  id="addr-state"
                  placeholder="Greater London"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="zipCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Zip or postal code</FormLabel>
            <FormControl>
              <Input
                id="addr-zipcode"
                placeholder="NW1 6XE"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
