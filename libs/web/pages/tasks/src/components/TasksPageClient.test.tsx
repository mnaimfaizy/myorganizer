import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Task } from '@myorganizer/core';
import {
  loadDecryptedData,
  migrateFromTodos,
  normalizeTasks,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { useToast } from '@myorganizer/web-ui';
import { TasksPageClient } from './TasksPageClient';

jest.mock('@myorganizer/core', () => ({
  ...jest.requireActual('@myorganizer/core'),
  randomId: jest.fn(() => 'mock-task-id'),
}));

jest.mock('@myorganizer/web-vault');

jest.mock('@myorganizer/web-vault-ui', () => ({
  VaultGate: ({
    children,
  }: {
    children: (props: { masterKeyBytes: Uint8Array }) => unknown;
  }) => children({ masterKeyBytes: new Uint8Array(32) }) as React.ReactElement,
}));

jest.mock('@myorganizer/web-ui', () => ({
  useToast: jest.fn(),
}));

jest.mock('./task-form', () => ({
  TaskForm: ({
    onSubmit,
  }: {
    onSubmit: (v: {
      title: string;
      priority: 'high' | 'medium' | 'low';
      status: 'pending' | 'in_progress' | 'done' | 'cancelled' | 'blocked';
      description?: string;
      context?: 'personal' | 'work';
      dueDate?: string;
    }) => void;
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
      Add Task
    </button>
  ),
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

const mockLoadDecryptedData = loadDecryptedData as jest.Mock;
const mockSaveEncryptedData = saveEncryptedData as jest.Mock;
const mockNormalizeTasks = normalizeTasks as jest.Mock;
const mockMigrateFromTodos = migrateFromTodos as jest.Mock;
const mockUseToast = useToast as jest.Mock;
const mockToast = jest.fn();

describe('TasksPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockLoadDecryptedData.mockResolvedValue([
      {
        id: 't1',
        title: 'Task 1',
        priority: 'medium',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      } as Task,
    ]);
    mockSaveEncryptedData.mockResolvedValue(undefined);
    mockNormalizeTasks.mockImplementation((raw) => ({
      value: Array.isArray(raw) ? raw : [],
      changed: false,
    }));
    mockMigrateFromTodos.mockImplementation((todos) =>
      Array.isArray(todos)
        ? todos.map((t: { id: string; todo: string }) => ({
            id: t.id,
            title: t.todo,
            priority: 'medium' as const,
            status: 'pending' as const,
            archived: false,
            createdAt: '2024-01-01T00:00:00.000Z',
          }))
        : [],
    );
  });

  it('should load tasks from vault on mount and call loadDecryptedData with type tasks', async () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Task One',
        priority: 'medium',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockLoadDecryptedData.mockResolvedValue(tasks);
    mockNormalizeTasks.mockReturnValue({ value: tasks, changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Task One')).toBeInTheDocument();
    });

    expect(mockLoadDecryptedData).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tasks', defaultValue: null }),
    );
  });

  it('should auto-migrate from todos when tasks blob is null and todos exist', async () => {
    mockLoadDecryptedData.mockImplementation(
      (opts: { type: string; defaultValue: unknown }) => {
        if (opts.type === 'tasks') return Promise.resolve(null);
        if (opts.type === 'todos')
          return Promise.resolve([{ id: 'todo1', todo: 'Migrate me' }]);
        return Promise.resolve(opts.defaultValue);
      },
    );
    const migratedTasks: Task[] = [
      {
        id: 'todo1',
        title: 'Migrate me',
        priority: 'medium',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockMigrateFromTodos.mockReturnValue(migratedTasks);

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Migrate me')).toBeInTheDocument();
    });

    expect(mockLoadDecryptedData).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'todos', defaultValue: [] }),
    );
    expect(mockMigrateFromTodos).toHaveBeenCalled();
    expect(mockSaveEncryptedData).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tasks', value: migratedTasks }),
    );
  });

  it('should not save when tasks blob is null and todos are empty', async () => {
    mockLoadDecryptedData.mockImplementation(
      (opts: { type: string; defaultValue: unknown }) => {
        if (opts.type === 'tasks') return Promise.resolve(null);
        if (opts.type === 'todos') return Promise.resolve([]);
        return Promise.resolve(opts.defaultValue);
      },
    );

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(mockLoadDecryptedData).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'todos' }),
      );
    });

    expect(mockSaveEncryptedData).not.toHaveBeenCalled();
  });

  it('should show destructive toast on load failure', async () => {
    mockLoadDecryptedData.mockRejectedValue(new Error('Decryption failed'));

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Failed to load tasks',
          description: 'Could not decrypt saved data.',
        }),
      );
    });
  });

  it('should re-save when normalization reports changed=true', async () => {
    const rawTasks = [
      { id: 't1', title: 'Task One', priority: 'high', createdAt: '...' },
    ];
    const normalizedTasks: Task[] = [
      {
        id: 't1',
        title: 'Task One',
        priority: 'high',
        status: 'pending',
        archived: false,
        createdAt: '...',
      },
    ];
    mockLoadDecryptedData.mockResolvedValue(rawTasks);
    mockNormalizeTasks.mockReturnValue({
      value: normalizedTasks,
      changed: true,
    });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(mockSaveEncryptedData).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tasks', value: normalizedTasks }),
      );
    });
  });

  it('should render tasks sorted by priority: high before medium before low', async () => {
    const tasks: Task[] = [
      {
        id: 'low',
        title: 'Low Priority',
        priority: 'low',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'high',
        title: 'High Priority',
        priority: 'high',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'medium',
        title: 'Medium Priority',
        priority: 'medium',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    mockLoadDecryptedData.mockResolvedValue(tasks);
    mockNormalizeTasks.mockReturnValue({ value: tasks, changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      const titles = screen
        .getAllByRole('heading', { level: 3 })
        .map((el) => el.textContent);
      expect(titles).toEqual([
        'High Priority',
        'Medium Priority',
        'Low Priority',
      ]);
    });
  });

  it('should save vault and show task in list after form submit', async () => {
    mockLoadDecryptedData.mockResolvedValue([]);
    mockNormalizeTasks.mockReturnValue({ value: [], changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(mockLoadDecryptedData).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tasks' }),
      );
    });

    fireEvent.click(screen.getByTestId('add-task-btn'));

    await waitFor(() => {
      expect(mockSaveEncryptedData).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tasks' }),
      );
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Task created' }),
      );
    });
  });

  it('should remove task and save vault after delete', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to delete',
      priority: 'medium',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockLoadDecryptedData.mockResolvedValue([task]);
    mockNormalizeTasks.mockReturnValue({ value: [task], changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(mockSaveEncryptedData).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tasks', value: [] }),
      );
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Task deleted' }),
      );
    });
  });

  it('should open edit dialog and save edit with updatedAt', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to edit',
      priority: 'high',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockLoadDecryptedData.mockResolvedValue([task]);
    mockNormalizeTasks.mockReturnValue({ value: [task], changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('editing-task-title')).toHaveTextContent(
        'Task to edit',
      );
    });

    fireEvent.click(screen.getByTestId('save-edit-btn'));

    await waitFor(() => {
      expect(mockSaveEncryptedData).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks',
          value: expect.arrayContaining([
            expect.objectContaining({
              id: 't1',
              title: 'Updated Title',
              priority: 'low',
              status: 'done',
              updatedAt: expect.any(String),
            }),
          ]),
        }),
      );
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Task updated' }),
      );
    });
  });

  it('should close edit dialog when close button clicked', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to edit',
      priority: 'high',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockLoadDecryptedData.mockResolvedValue([task]);
    mockNormalizeTasks.mockReturnValue({ value: [task], changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('close-edit-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('edit-dialog')).not.toBeInTheDocument();
    });
  });

  it('should archive task with archived:true and updatedAt', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to archive',
      priority: 'medium',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockLoadDecryptedData.mockResolvedValue([task]);
    mockNormalizeTasks.mockReturnValue({ value: [task], changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('archive-t1'));

    await waitFor(() => {
      expect(mockSaveEncryptedData).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tasks',
          value: expect.arrayContaining([
            expect.objectContaining({
              id: 't1',
              archived: true,
              updatedAt: expect.any(String),
            }),
          ]),
        }),
      );
    });
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Task archived' }),
      );
    });
  });

  it('should hide archived tasks by default', async () => {
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
    mockLoadDecryptedData.mockResolvedValue(tasks);
    mockNormalizeTasks.mockReturnValue({ value: tasks, changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Active task')).toBeInTheDocument();
    });

    expect(screen.queryByText('Archived task')).not.toBeInTheDocument();
  });

  it('should show archived tasks when "Show Archived" button clicked', async () => {
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
    mockLoadDecryptedData.mockResolvedValue(tasks);
    mockNormalizeTasks.mockReturnValue({ value: tasks, changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Active task')).toBeInTheDocument();
    });

    const showArchivedBtn = screen.getByRole('button', {
      name: 'Show Archived',
    });
    fireEvent.click(showArchivedBtn);

    await waitFor(() => {
      expect(screen.getByText('Archived task')).toBeInTheDocument();
    });
  });

  it('should filter tasks by context: "Personal" button shows only personal tasks', async () => {
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
    mockLoadDecryptedData.mockResolvedValue(tasks);
    mockNormalizeTasks.mockReturnValue({ value: tasks, changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Personal task')).toBeInTheDocument();
      expect(screen.getByText('Work task')).toBeInTheDocument();
    });

    const personalBtn = screen.getByRole('button', { name: 'Personal' });
    fireEvent.click(personalBtn);

    await waitFor(() => {
      expect(screen.getByText('Personal task')).toBeInTheDocument();
      expect(screen.queryByText('Work task')).not.toBeInTheDocument();
    });
  });

  it('should filter tasks by context: "Work" button shows only work tasks', async () => {
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
    mockLoadDecryptedData.mockResolvedValue(tasks);
    mockNormalizeTasks.mockReturnValue({ value: tasks, changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Personal task')).toBeInTheDocument();
      expect(screen.getByText('Work task')).toBeInTheDocument();
    });

    const workBtn = screen.getByRole('button', { name: 'Work' });
    fireEvent.click(workBtn);

    await waitFor(() => {
      expect(screen.queryByText('Personal task')).not.toBeInTheDocument();
      expect(screen.getByText('Work task')).toBeInTheDocument();
    });
  });

  it('should show all non-archived tasks when "All" filter button clicked', async () => {
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
    mockLoadDecryptedData.mockResolvedValue(tasks);
    mockNormalizeTasks.mockReturnValue({ value: tasks, changed: false });

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByText('Personal task')).toBeInTheDocument();
      expect(screen.getByText('Work task')).toBeInTheDocument();
    });

    const personalBtn = screen.getByRole('button', { name: 'Personal' });
    fireEvent.click(personalBtn);

    await waitFor(() => {
      expect(screen.queryByText('Work task')).not.toBeInTheDocument();
    });

    const allBtn = screen.getByRole('button', { name: 'All' });
    fireEvent.click(allBtn);

    await waitFor(() => {
      expect(screen.getByText('Personal task')).toBeInTheDocument();
      expect(screen.getByText('Work task')).toBeInTheDocument();
    });
  });

  it('should show destructive toast on save failure', async () => {
    const task: Task = {
      id: 't1',
      title: 'Task to edit',
      priority: 'high',
      status: 'pending',
      archived: false,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockLoadDecryptedData.mockResolvedValue([task]);
    mockNormalizeTasks.mockReturnValue({ value: [task], changed: false });
    mockSaveEncryptedData.mockRejectedValueOnce(new Error('Save failed'));

    render(<TasksPageClient />);

    await waitFor(() => {
      expect(screen.getByTestId('task-t1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('save-edit-btn'));

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
