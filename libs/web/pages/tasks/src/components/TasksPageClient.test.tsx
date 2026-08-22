/** Mocking rule: place jest.mock calls before any imports */
/* eslint-disable import/first -- jest.mock must precede application imports */

jest.mock('@myorganizer/web-ui', () => ({
  useToast: jest.fn(),
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) =>
    open ? (
      <div data-testid="radix-dialog-root" role="dialog">
        {children}
      </div>
    ) : null,
  DialogContent: ({
    children,
  }: {
    children: React.ReactNode;
    showCloseButton?: boolean;
  }) => <div data-testid="radix-dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

jest.mock('@myorganizer/web-vault-ui', () => ({
  VaultGate: ({
    children,
  }: {
    children: (props: { masterKeyBytes: Uint8Array }) => unknown;
  }) => children({ masterKeyBytes: new Uint8Array(32) }) as React.ReactElement,
}));

jest.mock('../workflow');

jest.mock('./task-form', () => ({
  TaskForm: ({
    onSubmit,
    submitLabel = 'Submit',
  }: {
    onSubmit: (v: {
      title: string;
      priority: 'high' | 'medium' | 'low';
      status: 'pending' | 'in_progress' | 'done' | 'cancelled' | 'blocked';
      description?: string;
      context?: 'personal' | 'work';
      dueDate?: string;
    }) => Promise<void> | void;
    submitLabel?: string;
  }) => (
    <button
      data-testid="add-task-btn"
      onClick={() =>
        onSubmit({
          title: 'New Task',
          priority: 'high',
          status: 'pending',
          dueDate: undefined,
        })
      }
    >
      {submitLabel}
    </button>
  ),
}));

jest.mock('./task-add-dialog', () => ({
  TaskAddDialog: ({
    isOpen,
    onClose,
    onSubmit,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (values: {
      title: string;
      description?: string;
      priority: string;
      status: string;
      context?: string;
      dueDate?: string;
    }) => Promise<void>;
  }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="add-dialog">
        <button data-testid="add-dialog-close" onClick={onClose}>
          Close
        </button>
        {/* Render the mocked TaskForm which will submit */}
        {/* eslint-disable-next-line */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              title: 'New Task',
              priority: 'high',
              status: 'pending',
            })
              .then(() => {
                // Form submission succeeded, close dialog
                onClose();
              })
              .catch(() => {
                // Form submission failed, dialog should stay open
              });
          }}
        >
          <input type="text" placeholder="Task title" />
          <button type="submit" data-testid="add-task-btn">
            Add Task
          </button>
        </form>
      </div>
    );
  },
}));

jest.mock('./task-item', () => ({
  __esModule: true,
  default: ({
    task,
    onDeleteTask,
    onEditTask,
    onArchiveTask,
    _onUnarchiveTask,
  }: {
    task: { id: string; title: string; priority: string };
    onDeleteTask: (id: string) => void;
    onEditTask: (id: string) => void;
    onArchiveTask: (id: string) => void;
    _onUnarchiveTask: (id: string) => void;
  }) => (
    <div data-testid={`task-${task.id}`}>
      <h3>{task.title}</h3>
      <span data-testid={`priority-${task.id}`}>{task.priority}</span>
      <button
        data-testid={`delete-${task.id}`}
        onClick={() => onDeleteTask(task.id)}
      >
        Delete
      </button>
      <button
        data-testid={`edit-${task.id}`}
        onClick={() => onEditTask(task.id)}
      >
        Edit
      </button>
      <button
        data-testid={`archive-${task.id}`}
        onClick={() => onArchiveTask(task.id)}
      >
        Archive
      </button>
    </div>
  ),
}));

jest.mock('./task-edit-dialog', () => ({
  TaskEditDialog: ({
    task,
    isOpen,
    onSave,
    onClose,
  }: {
    task: { id: string; title: string } | null;
    isOpen: boolean;
    onSave: (id: string, values: object) => void;
    onClose: () => void;
  }) =>
    isOpen && task ? (
      <div data-testid="edit-dialog">
        <span data-testid="editing-task-title">{task.title}</span>
        <button
          data-testid="save-edit-btn"
          onClick={() =>
            onSave(task.id, {
              title: 'Updated Title',
              priority: 'low',
              status: 'done',
            })
          }
        >
          Save
        </button>
        <button data-testid="close-edit-btn" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

jest.mock('./task-delete-dialog', () => ({
  TaskDeleteDialog: ({
    task,
    isOpen,
    onConfirm,
    onClose,
  }: {
    task: { id: string; title: string } | null;
    isOpen: boolean;
    onConfirm: () => void;
    onClose: () => void;
  }) =>
    isOpen && task ? (
      <div data-testid="delete-dialog">
        <span data-testid="deleting-task-title">{task.title}</span>
        <button data-testid="confirm-delete-btn" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="cancel-delete-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    ) : null,
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Task } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import { TasksPageClient } from './TasksPageClient';
import { useTasksWorkflow } from '../workflow';

const mockUseToast = useToast as jest.Mock;
const mockUseTasksWorkflow = useTasksWorkflow as jest.Mock;

const mockToast = jest.fn();

function makeWorkflowState(
  overrides?: Partial<ReturnType<typeof useTasksWorkflow>>,
) {
  return {
    tasks: [] as Task[],
    loading: false,
    loadError: null,
    addTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    archiveTask: jest.fn(),
    unarchiveTask: jest.fn(),
    ...overrides,
  };
}

describe('TasksPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState());
  });

  it('does not render create form on first load', () => {
    render(<TasksPageClient />);
    expect(screen.queryByTestId('add-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Task List')).toBeInTheDocument();
  });

  it('renders Add Task button in header', () => {
    render(<TasksPageClient />);
    const addButton = screen.getByRole('button', { name: 'Add Task' });
    expect(addButton).toBeInTheDocument();
  });

  it('opening Add Task button shows dialog with form', async () => {
    render(<TasksPageClient />);
    const addButton = screen.getByRole('button', { name: 'Add Task' });

    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId('add-dialog')).toBeInTheDocument();
    });
  });

  it('renders tasks from workflow', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Task One',
        priority: 'high',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Task Two',
        priority: 'medium',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks }));

    render(<TasksPageClient />);

    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.getByText('Task Two')).toBeInTheDocument();
  });

  it('calls useTasksWorkflow with masterKeyBytes from VaultGate', () => {
    render(<TasksPageClient />);

    expect(mockUseTasksWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        masterKeyBytes: expect.any(Uint8Array),
      }),
    );
  });

  it('shows load error toast when workflow.loadError is set', async () => {
    const loadError = { code: 'load_failed' as const, message: 'Vault error' };
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ loadError }));

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to load tasks',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        }),
      );
    });
  });

  it('submitting form in dialog creates task and closes dialog', async () => {
    const mockAddTask = jest.fn().mockResolvedValue({
      ok: true,
      kind: 'created',
    });
    mockUseTasksWorkflow.mockReturnValue(
      makeWorkflowState({ addTask: mockAddTask }),
    );

    render(<TasksPageClient />);

    // Open the dialog
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => {
      expect(screen.getByTestId('add-dialog')).toBeInTheDocument();
    });

    // Submit the form in the dialog
    fireEvent.click(screen.getByTestId('add-task-btn'));

    await waitFor(() => {
      expect(mockAddTask).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Task created',
          description: 'Your task has been saved (encrypted).',
        }),
      );
    });

    // Dialog should close after successful submission
    await waitFor(() => {
      expect(screen.queryByTestId('add-dialog')).not.toBeInTheDocument();
    });
  });

  it('failed form submission keeps dialog open with values', async () => {
    const mockAddTask = jest.fn().mockResolvedValue({
      ok: false,
      error: { code: 'save_failed' as const, message: 'Save error' },
    });
    mockUseTasksWorkflow.mockReturnValue(
      makeWorkflowState({ addTask: mockAddTask }),
    );

    render(<TasksPageClient />);

    // Open the dialog
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => {
      expect(screen.getByTestId('add-dialog')).toBeInTheDocument();
    });

    // Submit the form
    fireEvent.click(screen.getByTestId('add-task-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to save',
          description: 'Save error',
          variant: 'destructive',
        }),
      );
    });

    // Dialog should remain open after failed submission
    expect(screen.getByTestId('add-dialog')).toBeInTheDocument();
  });

  it('closing dialog via close button dismisses without saving', async () => {
    const mockAddTask = jest.fn();
    mockUseTasksWorkflow.mockReturnValue(
      makeWorkflowState({ addTask: mockAddTask }),
    );

    render(<TasksPageClient />);

    // Open the dialog
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => {
      expect(screen.getByTestId('add-dialog')).toBeInTheDocument();
    });

    // Click the close button
    fireEvent.click(screen.getByTestId('add-dialog-close'));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId('add-dialog')).not.toBeInTheDocument();
    });

    // No task should have been added
    expect(mockAddTask).not.toHaveBeenCalled();
  });

  it('opens delete dialog when delete button clicked', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to delete',
      priority: 'medium',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks: [task] }));

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('delete-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('deleting-task-title')).toHaveTextContent(
        'Task to delete',
      );
    });
  });

  it('calls deleteTask on delete confirmation and shows success toast', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to delete',
      priority: 'medium',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const mockDeleteTask = jest.fn().mockResolvedValue({
      ok: true,
      kind: 'deleted',
    });
    mockUseTasksWorkflow.mockReturnValue(
      makeWorkflowState({ tasks: [task], deleteTask: mockDeleteTask }),
    );

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('delete-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(mockDeleteTask).toHaveBeenCalledWith('t1');
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Task deleted',
          description: 'Your task has been deleted.',
        }),
      );
    });
  });

  it('closes delete dialog on cancel', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to delete',
      priority: 'medium',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks: [task] }));

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('delete-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancel-delete-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
    });
  });

  it('opens edit dialog when edit button clicked', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to edit',
      priority: 'high',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks: [task] }));

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('edit-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('editing-task-title')).toHaveTextContent(
        'Task to edit',
      );
    });
  });

  it('calls updateTask on edit save and shows success toast', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to edit',
      priority: 'high',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const mockUpdateTask = jest.fn().mockResolvedValue({
      ok: true,
      kind: 'updated',
    });
    mockUseTasksWorkflow.mockReturnValue(
      makeWorkflowState({ tasks: [task], updateTask: mockUpdateTask }),
    );

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('edit-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('save-edit-btn'));

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith('t1', {
        title: 'Updated Title',
        priority: 'low',
        status: 'done',
      });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Task updated',
          description: 'Changes saved (encrypted).',
        }),
      );
    });
  });

  it('closes edit dialog on close button click', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to edit',
      priority: 'high',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks: [task] }));

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('edit-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('close-edit-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('edit-dialog')).not.toBeInTheDocument();
    });
  });

  it('calls archiveTask and shows success toast', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to archive',
      priority: 'medium',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const mockArchiveTask = jest.fn().mockResolvedValue({
      ok: true,
      kind: 'archived',
    });
    mockUseTasksWorkflow.mockReturnValue(
      makeWorkflowState({ tasks: [task], archiveTask: mockArchiveTask }),
    );

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('archive-t1'));

    await waitFor(() => {
      expect(mockArchiveTask).toHaveBeenCalledWith('t1');
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Task archived',
          description: 'Task moved to archive.',
        }),
      );
    });
  });

  it('hides archived tasks by default', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Active task',
        priority: 'medium',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Archived task',
        priority: 'medium',
        status: 'done',
        archived: true,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks }));

    render(<TasksPageClient />);

    expect(screen.getByText('Active task')).toBeInTheDocument();
    expect(screen.queryByText('Archived task')).not.toBeInTheDocument();
  });

  it('shows archived tasks when Show Archived button clicked', async () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Active task',
        priority: 'medium',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Archived task',
        priority: 'medium',
        status: 'done',
        archived: true,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks }));

    render(<TasksPageClient />);

    fireEvent.click(screen.getByRole('button', { name: 'Show Archived' }));

    await waitFor(() => {
      expect(screen.getByText('Archived task')).toBeInTheDocument();
    });
  });

  it('filters to personal context only when Personal button clicked', async () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Personal task',
        priority: 'medium',
        status: 'pending',
        context: 'personal',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Work task',
        priority: 'medium',
        status: 'pending',
        context: 'work',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks }));

    render(<TasksPageClient />);

    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));

    await waitFor(() => {
      expect(screen.getByText('Personal task')).toBeInTheDocument();
      expect(screen.queryByText('Work task')).not.toBeInTheDocument();
    });
  });

  it('filters to work context only when Work button clicked', async () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Personal task',
        priority: 'medium',
        status: 'pending',
        context: 'personal',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Work task',
        priority: 'medium',
        status: 'pending',
        context: 'work',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks }));

    render(<TasksPageClient />);

    fireEvent.click(screen.getByRole('button', { name: 'Work' }));

    await waitFor(() => {
      expect(screen.queryByText('Personal task')).not.toBeInTheDocument();
      expect(screen.getByText('Work task')).toBeInTheDocument();
    });
  });

  it('shows all tasks when All filter button clicked after context filter', async () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Personal task',
        priority: 'medium',
        status: 'pending',
        context: 'personal',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 't2',
        title: 'Work task',
        priority: 'medium',
        status: 'pending',
        context: 'work',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockUseTasksWorkflow.mockReturnValue(makeWorkflowState({ tasks }));

    render(<TasksPageClient />);

    fireEvent.click(screen.getByRole('button', { name: 'Personal' }));

    await waitFor(() => {
      expect(screen.queryByText('Work task')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    await waitFor(() => {
      expect(screen.getByText('Personal task')).toBeInTheDocument();
      expect(screen.getByText('Work task')).toBeInTheDocument();
    });
  });

  it('shows save_failed toast when updateTask mutation fails', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to edit',
      priority: 'high',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const mockUpdateTask = jest.fn().mockResolvedValue({
      ok: false,
      error: { code: 'save_failed' as const, message: 'Network error' },
    });
    mockUseTasksWorkflow.mockReturnValue(
      makeWorkflowState({ tasks: [task], updateTask: mockUpdateTask }),
    );

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('edit-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('save-edit-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to save',
          description: 'Network error',
          variant: 'destructive',
        }),
      );
    });
  });

  it('shows save_failed toast when archiveTask mutation fails', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to archive',
      priority: 'medium',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    const mockArchiveTask = jest.fn().mockResolvedValue({
      ok: false,
      error: { code: 'save_failed' as const, message: 'Save failed' },
    });
    mockUseTasksWorkflow.mockReturnValue(
      makeWorkflowState({ tasks: [task], archiveTask: mockArchiveTask }),
    );

    render(<TasksPageClient />);

    fireEvent.click(screen.getByTestId('archive-t1'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to save',
          description: 'Save failed',
          variant: 'destructive',
        }),
      );
    });
  });
});
