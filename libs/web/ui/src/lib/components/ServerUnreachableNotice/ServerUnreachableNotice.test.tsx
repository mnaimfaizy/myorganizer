import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ServerUnreachableNotice } from './ServerUnreachableNotice';

describe('ServerUnreachableNotice', () => {
  it('announces the unreachable server with the title "Can\'t reach the server"', () => {
    render(<ServerUnreachableNotice onRetry={jest.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Can't reach the server");
  });

  it('calls onRetry when Try again is clicked', () => {
    const onRetry = jest.fn();
    render(<ServerUnreachableNotice onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('labels the button "Retrying…", disables and marks it busy while retrying, and ignores clicks', () => {
    const onRetry = jest.fn();
    render(<ServerUnreachableNotice onRetry={onRetry} retrying />);

    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Retrying…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(button);

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('keeps the idle button labelled "Try again", enabled, and not busy', () => {
    render(<ServerUnreachableNotice onRetry={jest.fn()} />);

    const button = screen.getByRole('button', { name: 'Try again' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByText('Retrying…')).not.toBeInTheDocument();
  });

  it('offers no sign-in path: no links and no sign-in or log-in controls', () => {
    render(<ServerUnreachableNotice onRetry={jest.fn()} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /sign in|log in|login/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in|log in|login/i)).not.toBeInTheDocument();
  });
});
