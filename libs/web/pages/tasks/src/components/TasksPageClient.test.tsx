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
  __esModule: true,
  default: ({
    onAddTask,
  }: {
    onAddTask: (v: {
      title: string;
      priority: 'high' | 'medium' | 'low';
      dueDate?: string;
    }) => void;
  }) => (
    <button
      data-testid="add-task-btn"
      onClick={() =>
        onAddTask({ title: 'New Task', priority: 'high', dueDate: undefined })
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
  }: {
    task: { id: string; title: string; priority: string };
    onDeleteTask: (id: string) => void;
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
    </div>
  ),
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
        ? todos.map((t: unknown) => {
            const item = t as { id: string; todo: string };
            return {
              id: item.id,
              title: item.todo,
              priority: 'medium' as const,
              status: 'pending' as const,
              archived: false,
              createdAt: '2024-01-01T00:00:00.000Z',
            };
          })
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
    expect(mockMigrateFromTodos).toHaveBeenCalledWith([
      { id: 'todo1', todo: 'Migrate me' },
    ]);
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
      {
        id: 't1',
        title: 'Task One',
        priority: 'high',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    const normalizedTasks: Task[] = [
      {
        id: 't1',
        title: 'Task One',
        priority: 'high',
        status: 'pending',
        archived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
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
      expect(mockSaveEncryptedData).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tasks', value: [] }),
      );
    });
  });
});
