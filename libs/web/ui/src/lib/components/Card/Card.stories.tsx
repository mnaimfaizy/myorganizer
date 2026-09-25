import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '../Button/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card';

function CardWithHeaderAndContentExample() {
  return (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Weekly review</CardTitle>
        <CardDescription>
          Summary of tasks completed and reminders due this week.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          You finished 12 tasks, cleared 3 overdue reminders, and shared 2
          folders with collaborators.
        </p>
      </CardContent>
    </Card>
  );
}

function CardWithFooterExample() {
  return (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Export workspace</CardTitle>
        <CardDescription>
          Download a copy of your tasks and shared folders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          The export includes task titles, due dates, and collaborator lists.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Start export</Button>
      </CardFooter>
    </Card>
  );
}

function CardWithoutFooterExample() {
  return (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
        <CardDescription>
          Choose how you receive reminders and collaborator updates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Email digests are sent every Monday at 8:00 AM. Push notifications
          follow your device settings.
        </p>
      </CardContent>
    </Card>
  );
}

function CardLongContentExample() {
  return (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>
          Terms for exporting archived workspace projects and shared folders
        </CardTitle>
        <CardDescription>
          Review the full export scope before downloading a copy of your
          organizer workspace, including archived projects, shared folders,
          collaborator permissions, and linked notification settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Exports may take several minutes for large workspaces. You will
          receive an email when the archive is ready. The download link expires
          after seven days. Contact support if you need an extended retention
          window or a partial export of specific folders only.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline">Learn more</Button>
      </CardFooter>
    </Card>
  );
}

const meta: Meta<typeof CardWithHeaderAndContentExample> = {
  component: CardWithHeaderAndContentExample,
  title: 'Components/Card',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CardWithHeaderAndContentExample>;

export const WithHeaderAndContent: Story = {};

export const WithFooter: Story = {
  render: function Render() {
    return <CardWithFooterExample />;
  },
};

export const WithoutFooter: Story = {
  render: function Render() {
    return <CardWithoutFooterExample />;
  },
};

export const LongContent: Story = {
  render: function Render() {
    return <CardLongContentExample />;
  },
};
