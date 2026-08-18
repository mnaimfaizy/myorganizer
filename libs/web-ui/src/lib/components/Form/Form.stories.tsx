import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Input } from '../Input/Input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './Form';

type ProfileFormValues = {
  name: string;
  email: string;
};

function FormEmptyExample() {
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      name: '',
      email: '',
    },
  });

  return (
    <Form {...form}>
      <form className="w-[380px] space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Jane Doe" {...field} />
              </FormControl>
              <FormDescription>
                Your display name across the workspace.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="jane@example.com" {...field} />
              </FormControl>
              <FormDescription>
                Used for reminders and collaborator invitations.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

function FormFilledExample() {
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    },
  });

  return (
    <Form {...form}>
      <form className="w-[380px] space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Your display name across the workspace.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormDescription>
                Used for reminders and collaborator invitations.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

function FormValidationErrorExample() {
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      name: '',
      email: 'not-an-email',
    },
  });

  useEffect(() => {
    form.setError('email', {
      type: 'manual',
      message: 'Enter a valid email address.',
    });
  }, [form]);

  return (
    <Form {...form}>
      <form className="w-[380px] space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Jane Doe" {...field} />
              </FormControl>
              <FormDescription>
                Your display name across the workspace.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormDescription>
                Used for reminders and collaborator invitations.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

const meta: Meta<typeof FormEmptyExample> = {
  component: FormEmptyExample,
  title: 'Components/Form',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FormEmptyExample>;

export const Empty: Story = {};

export const Filled: Story = {
  render: function Render() {
    return <FormFilledExample />;
  },
};

export const ValidationError: Story = {
  render: function Render() {
    return <FormValidationErrorExample />;
  },
};
