/* eslint-disable import/first */
jest.mock('@myorganizer/web-vault');

import { render, screen, waitFor } from '@testing-library/react';

import type { Task } from '@myorganizer/core';
import { normalizeTasks, type VaultHandle } from '@myorganizer/web-vault';
import { TasksSummaryCard } from './TasksSummaryCard';

const createMockHandle = (loadDecryptedDataMock?: jest.Mock): VaultHandle => {
  const mock = loadDecryptedDataMock || jest.fn().mockResolvedValue([]);
  return {
    owner: 'test-user',
    isUnlocked: true,
    hasVault: jest.fn(),
    loadVault: jest.fn(),
    saveVault: jest.fn(),
    initialize: jest.fn(),
    unlockWithPassphrase: jest.fn(),
    unlockWithRecoveryKey: jest.fn(),
    changePassphrase: jest.fn(),
    loadDecryptedData: mock,
    saveEncryptedData: jest.fn(),
  } as unknown as VaultHandle;
};

describe('TasksSummaryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock setup
    (normalizeTasks as jest.Mock).mockReturnValue({ value: [] });
  });

  describe('when handle is null or locked', () => {
    it('should render unlock vault message when handle is null', () => {
      render(<TasksSummaryCard handle={null} />);
      expect(screen.getByText('Unlock vault to view')).toBeInTheDocument();
    });

    it('should render lock icon with unlock message when handle is null', () => {
      render(<TasksSummaryCard handle={null} />);
      // The Lock icon and message should both be present
      expect(screen.getByText('Unlock vault to view')).toBeInTheDocument();
    });

    it('should not attempt to load encrypted data when handle is locked', () => {
      const mockHandle = createMockHandle();
      // Mock with locked state
      mockHandle.isUnlocked = false;
      render(<TasksSummaryCard handle={mockHandle} />);
      expect(mockHandle.loadDecryptedData).not.toHaveBeenCalled();
    });
  });

  describe('when loading encrypted data', () => {
    it('should display loading message while data is loading', () => {
      // Mock loadDecryptedData to never resolve
      const mockLoadDecryptedData = jest.fn(
        () =>
          new Promise(() => {
            // Intentionally empty - promise that never resolves
          }),
      );
      const mockHandle = createMockHandle(mockLoadDecryptedData);

      render(<TasksSummaryCard handle={mockHandle} />);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('should call loadDecryptedData with correct parameters', () => {
      const mockLoadDecryptedData = jest.fn(
        () =>
          new Promise(() => {
            // Intentionally empty - promise that never resolves
          }),
      );
      const mockHandle = createMockHandle(mockLoadDecryptedData);

      render(<TasksSummaryCard handle={mockHandle} />);

      expect(mockHandle.loadDecryptedData).toHaveBeenCalledWith({
        type: 'tasks',
        defaultValue: [],
      });
    });
  });

  describe('when data loads successfully', () => {
    it('should display total count and status breakdown with all statuses', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
        { id: '2', status: 'in_progress', archived: false },
        { id: '3', status: 'done', archived: false },
        { id: '4', status: 'cancelled', archived: false },
        { id: '5', status: 'blocked', archived: false },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });

      // Check for status breakdown
      expect(
        screen.getByText(
          '1 pending · 1 in progress · 1 done · 1 cancelled · 1 blocked',
        ),
      ).toBeInTheDocument();
    });

    it('should display only non-zero status counts in breakdown', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
        { id: '2', status: 'pending', archived: false },
        { id: '3', status: 'done', archived: false },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      // Should only show pending and done, not in_progress, cancelled, or blocked
      expect(screen.getByText('2 pending · 1 done')).toBeInTheDocument();
    });

    it('should call normalizeTasks with decrypted data', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(normalizeTasks).toHaveBeenCalledWith(mockTasks);
      });
    });

    it('should count only non-archived tasks', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
        { id: '2', status: 'pending', archived: true },
        { id: '3', status: 'in_progress', archived: false },
        { id: '4', status: 'in_progress', archived: true },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        // Should only count 2 non-archived tasks
        expect(screen.getByText('2')).toBeInTheDocument();
      });

      expect(screen.getByText('1 pending · 1 in progress')).toBeInTheDocument();
    });

    it('should correctly count each task status', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
        { id: '2', status: 'pending', archived: false },
        { id: '3', status: 'in_progress', archived: false },
        { id: '4', status: 'in_progress', archived: false },
        { id: '5', status: 'in_progress', archived: false },
        { id: '6', status: 'done', archived: false },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('6')).toBeInTheDocument();
      });

      expect(
        screen.getByText('2 pending · 3 in progress · 1 done'),
      ).toBeInTheDocument();
    });

    it('should display no tasks message when all tasks are archived', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: true },
        { id: '2', status: 'in_progress', archived: true },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });

      expect(screen.getByText('no tasks')).toBeInTheDocument();
    });
  });

  describe('when data is empty', () => {
    it('should display zero total and no tasks message', async () => {
      const mockHandle = createMockHandle(jest.fn().mockResolvedValue([]));
      (normalizeTasks as jest.Mock).mockReturnValue({ value: [] });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });

      expect(screen.getByText('no tasks')).toBeInTheDocument();
    });
  });

  describe('when loadDecryptedData fails', () => {
    it('should handle error and display no tasks', async () => {
      const mockHandle = createMockHandle(
        jest.fn().mockRejectedValue(new Error('Decryption failed')),
      );

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });

      expect(screen.getByText('no tasks')).toBeInTheDocument();
    });

    it('should not crash when loadDecryptedData rejects', async () => {
      const mockHandle = createMockHandle(
        jest.fn().mockRejectedValue(new Error('Network error')),
      );

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('no tasks')).toBeInTheDocument();
      });
    });
  });

  describe('status filter and display logic', () => {
    it('should handle single status with multiple tasks', async () => {
      const mockTasks = [
        { id: '1', status: 'done', archived: false },
        { id: '2', status: 'done', archived: false },
        { id: '3', status: 'done', archived: false },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      expect(screen.getByText('3 done')).toBeInTheDocument();
    });

    it('should use bullet separator between status parts', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
        { id: '2', status: 'in_progress', archived: false },
        { id: '3', status: 'blocked', archived: false },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(
          screen.getByText('1 pending · 1 in progress · 1 blocked'),
        ).toBeInTheDocument();
      });
    });

    it('should handle all five status types', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
        { id: '2', status: 'in_progress', archived: false },
        { id: '3', status: 'done', archived: false },
        { id: '4', status: 'cancelled', archived: false },
        { id: '5', status: 'blocked', archived: false },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });

      // All five statuses should appear
      expect(screen.getByText(/pending/)).toBeInTheDocument();
      expect(screen.getByText(/in progress/)).toBeInTheDocument();
      expect(screen.getByText(/done/)).toBeInTheDocument();
      expect(screen.getByText(/cancelled/)).toBeInTheDocument();
      expect(screen.getByText(/blocked/)).toBeInTheDocument();
    });
  });

  describe('integration with VaultStatCard wrapper', () => {
    it('should render the Tasks title within the card', () => {
      render(<TasksSummaryCard handle={null} />);
      expect(screen.getByText('Tasks')).toBeInTheDocument();
    });

    it('should pass handle through to content component', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
      ] as unknown as Task[];

      const mockHandle = createMockHandle(
        jest.fn().mockResolvedValue(mockTasks),
      );
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard handle={mockHandle} />);

      await waitFor(() => {
        expect(mockHandle.loadDecryptedData).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'tasks' }),
        );
      });
    });
  });
});
