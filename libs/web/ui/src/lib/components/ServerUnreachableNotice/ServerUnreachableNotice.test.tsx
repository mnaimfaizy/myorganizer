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

  it('disables and marks the button busy while retrying, and ignores clicks', () => {
    const onRetry = jest.fn();
    render(<ServerUnreachableNotice onRetry={onRetry} retrying />);

    const button = screen.getByRole('button', { name: 'Try again' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(button);

    expect(onRetry).not.toHaveBeenCalled();
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
