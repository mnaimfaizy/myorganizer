import type { Meta, StoryObj } from '@storybook/react';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './Table';

const TASK_ROWS = [
  {
    id: 'task-001',
    title: 'Review launch checklist',
    status: 'In progress',
    dueDate: 'Aug 12, 2026',
    assignee: 'Jane Doe',
  },
  {
    id: 'task-002',
    title: 'Send stakeholder update',
    status: 'To do',
    dueDate: 'Aug 14, 2026',
    assignee: 'Alex Kim',
  },
  {
    id: 'task-003',
    title: 'Archive completed sprint board',
    status: 'Done',
    dueDate: 'Aug 10, 2026',
    assignee: 'Sam Patel',
  },
  {
    id: 'task-004',
    title: 'Prepare Q3 roadmap draft',
    status: 'In progress',
    dueDate: 'Aug 16, 2026',
    assignee: 'Jordan Lee',
  },
  {
    id: 'task-005',
    title: 'Confirm design handoff',
    status: 'To do',
    dueDate: 'Aug 18, 2026',
    assignee: 'Taylor Nguyen',
  },
  {
    id: 'task-006',
    title: 'Schedule retrospective',
    status: 'To do',
    dueDate: 'Aug 20, 2026',
    assignee: 'Jane Doe',
  },
  {
    id: 'task-007',
    title: 'Update onboarding docs',
    status: 'In progress',
    dueDate: 'Aug 22, 2026',
    assignee: 'Alex Kim',
  },
  {
    id: 'task-008',
    title: 'Audit shared folder permissions',
    status: 'To do',
    dueDate: 'Aug 25, 2026',
    assignee: 'Sam Patel',
  },
];

function TableEmptyExample() {
  return (
    <Table>
      <TableCaption>Active tasks in your workspace</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due date</TableHead>
          <TableHead>Assignee</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody />
    </Table>
  );
}

function TableOneRowExample() {
  return (
    <Table>
      <TableCaption>Active tasks in your workspace</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due date</TableHead>
          <TableHead>Assignee</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Review launch checklist</TableCell>
          <TableCell>In progress</TableCell>
          <TableCell>Aug 12, 2026</TableCell>
          <TableCell>Jane Doe</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function TableManyRowsExample() {
  return (
    <div className="max-h-64 w-full">
      <Table>
        <TableCaption>Active tasks in your workspace</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead>Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {TASK_ROWS.map((task) => (
            <TableRow key={task.id}>
              <TableCell>{task.title}</TableCell>
              <TableCell>{task.status}</TableCell>
              <TableCell>{task.dueDate}</TableCell>
              <TableCell>{task.assignee}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const meta: Meta<typeof TableEmptyExample> = {
  component: TableEmptyExample,
  title: 'Components/Table',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TableEmptyExample>;

export const Empty: Story = {};

export const OneRow: Story = {
  render: function Render() {
    return <TableOneRowExample />;
  },
};

export const ManyRows: Story = {
  render: function Render() {
    return <TableManyRowsExample />;
  },
};
