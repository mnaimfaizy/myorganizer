import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { toast } from '../../hooks/use-toast';
import { clearToastState } from '../../hooks/use-toast.test-helpers';
import { Toaster } from './Toaster';

describe('Toaster', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    clearToastState();
    jest.useRealTimers();
  });

  it('shows the first toast title in the notifications region', () => {
    render(<Toaster />);

    act(() => {
      toast({ title: 'Passphrase changed' });
    });

    expect(
      screen.getByRole('region', { name: /notifications/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Passphrase changed')).toBeInTheDocument();
  });

  it('replaces the first toast with the second title on sequential toast calls', () => {
    render(<Toaster />);

    act(() => {
      toast({ title: 'Passphrase changed' });
    });

    expect(screen.getByText('Passphrase changed')).toBeInTheDocument();

    act(() => {
      toast({ title: 'Import complete' });
    });

    expect(
      screen.getByRole('region', { name: /notifications/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Import complete')).toBeInTheDocument();
    expect(screen.queryByText('Passphrase changed')).not.toBeInTheDocument();
  });
});
