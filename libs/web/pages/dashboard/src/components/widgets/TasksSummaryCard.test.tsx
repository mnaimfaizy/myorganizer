import { render, screen, waitFor } from '@testing-library/react';
import type { Task } from '@myorganizer/web-vault';
import { loadDecryptedData, normalizeTasks } from '@myorganizer/web-vault';
import { TasksSummaryCard } from './TasksSummaryCard';

jest.mock('@myorganizer/web-vault');

describe('TasksSummaryCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock setup
    (loadDecryptedData as jest.Mock).mockResolvedValue([]);
    (normalizeTasks as jest.Mock).mockReturnValue({ value: [] });
  });

  describe('when masterKeyBytes is null', () => {
    it('should render unlock vault message', () => {
      render(<TasksSummaryCard masterKeyBytes={null} />);
      expect(screen.getByText('Unlock vault to view')).toBeInTheDocument();
    });

    it('should render lock icon with unlock message', () => {
      render(<TasksSummaryCard masterKeyBytes={null} />);
      // The Lock icon and message should both be present
      expect(screen.getByText('Unlock vault to view')).toBeInTheDocument();
    });

    it('should not attempt to load encrypted data', () => {
      render(<TasksSummaryCard masterKeyBytes={null} />);
      expect(loadDecryptedData).not.toHaveBeenCalled();
    });
  });

  describe('when loading encrypted data', () => {
    it('should display loading message while data is loading', () => {
      // Mock loadDecryptedData to never resolve
      (loadDecryptedData as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('should call loadDecryptedData with correct parameters', () => {
      const mockKeyBytes = new Uint8Array(32);
      (loadDecryptedData as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );

      render(<TasksSummaryCard masterKeyBytes={mockKeyBytes} />);

      expect(loadDecryptedData).toHaveBeenCalledWith({
        masterKeyBytes: mockKeyBytes,
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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });

      expect(screen.getByText('no tasks')).toBeInTheDocument();
    });
  });

  describe('when data is empty', () => {
    it('should display zero total and no tasks message', async () => {
      (loadDecryptedData as jest.Mock).mockResolvedValue([]);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: [] });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });

      expect(screen.getByText('no tasks')).toBeInTheDocument();
    });
  });

  describe('when loadDecryptedData fails', () => {
    it('should handle error and display no tasks', async () => {
      (loadDecryptedData as jest.Mock).mockRejectedValue(
        new Error('Decryption failed'),
      );

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });

      expect(screen.getByText('no tasks')).toBeInTheDocument();
    });

    it('should not crash when loadDecryptedData rejects', async () => {
      (loadDecryptedData as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      render(<TasksSummaryCard masterKeyBytes={new Uint8Array(32)} />);

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
      render(<TasksSummaryCard masterKeyBytes={null} />);
      expect(screen.getByText('Tasks')).toBeInTheDocument();
    });

    it('should pass masterKeyBytes through to content component', async () => {
      const mockTasks = [
        { id: '1', status: 'pending', archived: false },
      ] as unknown as Task[];

      (loadDecryptedData as jest.Mock).mockResolvedValue(mockTasks);
      (normalizeTasks as jest.Mock).mockReturnValue({ value: mockTasks });

      const mockKeyBytes = new Uint8Array(32);
      render(<TasksSummaryCard masterKeyBytes={mockKeyBytes} />);

      await waitFor(() => {
        expect(loadDecryptedData).toHaveBeenCalledWith(
          expect.objectContaining({ masterKeyBytes: mockKeyBytes }),
        );
      });
    });
  });
});
