import { render, screen } from '@testing-library/react';

import { LastBackupCard } from './LastBackupCard';

describe('LastBackupCard', () => {
  test('renders empty state when record is null', () => {
    render(<LastBackupCard record={null} />);
    expect(screen.getByTestId('last-backup-empty').textContent).toBe(
      'No backups recorded yet',
    );
  });

  test('renders unknown state when record is undefined', () => {
    render(<LastBackupCard record={undefined} />);
    expect(screen.getByTestId('last-backup-unknown').textContent).toBe(
      'Last backup: unknown',
    );
  });

  test('renders loading state', () => {
    render(<LastBackupCard record={null} isLoading />);
    expect(screen.getByTestId('last-backup-loading')).not.toBeNull();
    expect(screen.queryByTestId('last-backup-empty')).toBeNull();
  });

  test('renders recorded state with formatted date and source', () => {
    render(
      <LastBackupCard
        record={{
          event: 'export',
          source: 'local-file',
          status: 'success',
          createdAt: '2026-04-01T12:34:56Z',
        }}
      />,
    );
    const node = screen.getByTestId('last-backup-recorded');
    expect(node.textContent).toMatch(/Last backup:/);
    expect(node.textContent).toMatch(/local-file/);
  });
});
