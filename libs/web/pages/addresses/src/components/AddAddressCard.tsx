import { zodResolver } from '@hookform/resolvers/zod';
import { AddressRecord } from '@myorganizer/core';
import {
  Badge,
  Button,
  Combobox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@myorganizer/web-ui';
import { AlertTriangle, CheckCircle2, MapPinned, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  ADDRESS_COUNTRY_OPTIONS,
  AddAddressFormValues,
  addAddressSchema,
  buildAddressFingerprint,
  createAddressPreview,
  findDuplicateAddress,
  getDefaultAddressCountryCode,
} from '../utils/addressForm';
import { formatAddress } from '../utils/formatAddress';

export function AddAddressCard(props: {
  open: boolean;
  items: AddressRecord[];
  onOpenChange: (open: boolean) => void;
  onAdd: (values: AddAddressFormValues) => Promise<AddressRecord>;
}) {
  const router = useRouter();
  const defaultValues = useMemo(
    () => ({
      label: 'Home',
      propertyNumber: '',
      street: '',
      suburb: '',
      state: '',
      zipCode: '',
      countryCode: getDefaultAddressCountryCode(),
    }),
    [],
  );

  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [savedAddress, setSavedAddress] = useState<AddressRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AddAddressFormValues>({
    resolver: zodResolver(addAddressSchema),
    defaultValues,
    mode: 'onChange',
  });

  const values = form.watch();
  const preview = createAddressPreview(values);
  const duplicateAddress = findDuplicateAddress(values, props.items);
  const currentFingerprint = buildAddressFingerprint({
    ...preview,
    countryCode: values.countryCode,
  });

  useEffect(() => {
    if (!props.open) return;

    form.reset(defaultValues);
    setAllowDuplicate(false);
    setSavedAddress(null);
  }, [defaultValues, form, props.open]);

  useEffect(() => {
    setAllowDuplicate(false);
  }, [currentFingerprint]);

  async function handleSubmit(nextValues: AddAddressFormValues) {
    const matchingAddress = findDuplicateAddress(nextValues, props.items);
    if (matchingAddress && !allowDuplicate) {
      setAllowDuplicate(true);
      return;
    }

    setIsSaving(true);
    try {
      const nextAddress = await props.onAdd(nextValues);
      setSavedAddress(nextAddress);
      setAllowDuplicate(false);
    } finally {
      setIsSaving(false);
    }
  }

  function resetForAnotherAddress() {
    form.reset({ ...defaultValues, label: values.label });
    setSavedAddress(null);
    setAllowDuplicate(false);
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-8">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle>Add address</SheetTitle>
              <SheetDescription>
                Create a private address record in your encrypted vault.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
          <StepBadge active done={Boolean(values.street)} label="Details" />
          <StepBadge active={Boolean(duplicateAddress)} label="Review" />
          <StepBadge active={Boolean(savedAddress)} label="Saved" />
        </div>

        {savedAddress ? (
          <div className="mt-6 space-y-4 rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
              <div className="space-y-1">
                <h3 className="font-semibold">Address saved</h3>
                <p className="text-sm text-muted-foreground">
                  {formatAddress(savedAddress)}
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                onClick={() =>
                  router.push(`/dashboard/addresses/${savedAddress.id}`)
                }
              >
                View address
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  router.push(
                    `/dashboard/addresses/${savedAddress.id}/add-location`,
                  )
                }
              >
                Add usage location
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={resetForAnotherAddress}
            >
              Add another address
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form
              className="mt-6 flex flex-1 flex-col gap-5"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                  control={form.control}
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
                control={form.control}
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

              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Preview</span>
                  <Badge variant="secondary">Encrypted</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatAddress({
                    id: 'preview',
                    status: 'current',
                    usageLocations: [],
                    createdAt: '',
                    ...preview,
                  })}
                </p>
              </div>

              {duplicateAddress && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">
                        This looks like an existing address.
                      </p>
                      <p className="text-sm">
                        {duplicateAddress.label}:{' '}
                        {formatAddress(duplicateAddress)}
                      </p>
                      {allowDuplicate && (
                        <p className="text-sm">
                          Select save again to keep this as a separate address.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <SheetFooter className="sticky bottom-0 mt-auto border-t bg-background pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => props.onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  <Plus className="h-4 w-4" />
                  {duplicateAddress && !allowDuplicate
                    ? 'Review duplicate'
                    : isSaving
                      ? 'Saving...'
                      : 'Save address'}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StepBadge(props: { active?: boolean; done?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          props.active || props.done
            ? 'h-2.5 w-2.5 rounded-full bg-primary'
            : 'h-2.5 w-2.5 rounded-full bg-muted-foreground/30'
        }
      />
      <span
        className={
          props.active || props.done
            ? 'font-medium text-foreground'
            : 'text-muted-foreground'
        }
      >
        {props.label}
      </span>
    </div>
  );
}
