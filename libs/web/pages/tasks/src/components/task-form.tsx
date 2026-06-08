'use client';

import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@myorganizer/web-ui';
import { TaskPriority, TaskStatus, TaskContext } from '@myorganizer/core';

interface TaskFormProps {
  onSubmit: (values: {
    title: string;
    description?: string;
    priority: TaskPriority;
    status: TaskStatus;
    context?: TaskContext;
    dueDate?: string;
  }) => void;
  initialValues?: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    context?: TaskContext;
    dueDate?: string;
  };
  submitLabel?: string;
}

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['pending', 'in_progress', 'done', 'cancelled', 'blocked']),
  context: z.string().optional(),
  dueDate: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export function TaskForm({
  onSubmit,
  initialValues,
  submitLabel = 'Add Task',
}: TaskFormProps) {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      priority: initialValues?.priority ?? 'medium',
      status: initialValues?.status ?? 'pending',
      context: initialValues?.context ?? 'none',
      dueDate: initialValues?.dueDate ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      priority: initialValues?.priority ?? 'medium',
      status: initialValues?.status ?? 'pending',
      context: initialValues?.context ?? 'none',
      dueDate: initialValues?.dueDate ?? '',
    });
  }, [initialValues, form]);

  const handleSubmit = useCallback(
    (values: TaskFormValues) => {
      const payload = {
        title: values.title,
        description: values.description || undefined,
        priority: values.priority,
        status: values.status as TaskStatus,
        context: (values.context && values.context !== 'none'
          ? values.context
          : undefined) as TaskContext | undefined,
        dueDate: values.dueDate || undefined,
      };
      onSubmit(payload);
      if (!initialValues) {
        form.reset();
      }
    },
    [onSubmit, form, initialValues],
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter task title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Enter task description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="context"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Context</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="work">Work</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Due Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">{submitLabel}</Button>
      </form>
    </Form>
  );
}
