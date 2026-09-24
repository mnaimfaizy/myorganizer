import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import { toast, useToast } from '../../hooks/use-toast';
import { Toaster } from './Toaster';

const TOAST_REMOVE_DELAY = 1000000;

function clearToastState() {
  const { result, unmount } = renderHook(() => useToast());
  act(() => {
    result.current.dismiss();
  });
  act(() => {
    jest.advanceTimersByTime(TOAST_REMOVE_DELAY);
  });
  unmount();
}

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
