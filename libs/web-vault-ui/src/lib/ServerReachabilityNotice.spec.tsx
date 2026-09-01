import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

import { ServerReachabilityNotice } from './ServerReachabilityNotice';

describe('ServerReachabilityNotice', () => {
  test('renders no visible label or detail for null reachability', () => {
    render(<ServerReachabilityNotice reachability={null} />);

    expect(
      screen.queryByTestId('server-reachability-label'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('server-reachability-detail'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('server-reachability-recheck-button'),
    ).not.toBeInTheDocument();
  });

  test('renders no visible label or detail for reachable', () => {
    render(<ServerReachabilityNotice reachability="reachable" />);

    expect(
      screen.queryByTestId('server-reachability-label'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('server-reachability-detail'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('server-reachability-recheck-button'),
    ).not.toBeInTheDocument();
  });

  test('renders label and detail for unreachable', () => {
    render(<ServerReachabilityNotice reachability="unreachable" />);

    const label = screen.getByTestId('server-reachability-label');
    const detail = screen.getByTestId('server-reachability-detail');

    expect(label).toBeInTheDocument();
    expect(label.textContent).toContain('Your other devices cannot be reached');
    expect(detail).toBeInTheDocument();
    expect(detail.textContent).toContain('You can still rotate now');
  });

  test('renders label and detail for signed-out', () => {
    render(<ServerReachabilityNotice reachability="signed-out" />);

    const label = screen.getByTestId('server-reachability-label');
    const detail = screen.getByTestId('server-reachability-detail');

    expect(label).toBeInTheDocument();
    expect(label.textContent).toContain('Your session has ended');
    expect(detail).toBeInTheDocument();
    expect(detail.textContent).toContain('You can still rotate now');
  });

  test('renders "Check again" button for unreachable when onRecheck is supplied', () => {
    const onRecheck = jest.fn();
    render(
      <ServerReachabilityNotice
        reachability="unreachable"
        onRecheck={onRecheck}
      />,
    );

    const button = screen.getByTestId('server-reachability-recheck-button');
    expect(button).toBeInTheDocument();
    expect(button.textContent).toBe('Check again');
  });

  test('does NOT render "Check again" button for unreachable when onRecheck is omitted', () => {
    render(<ServerReachabilityNotice reachability="unreachable" />);

    expect(
      screen.queryByTestId('server-reachability-recheck-button'),
    ).not.toBeInTheDocument();
  });

  test('does NOT render "Check again" button for signed-out even when onRecheck is supplied (canRecheck is false)', () => {
    const onRecheck = jest.fn();
    render(
      <ServerReachabilityNotice
        reachability="signed-out"
        onRecheck={onRecheck}
      />,
    );

    // Label and detail should be shown, but button should not
    expect(screen.getByTestId('server-reachability-label')).toBeInTheDocument();
    expect(
      screen.queryByTestId('server-reachability-recheck-button'),
    ).not.toBeInTheDocument();
  });

  test('clicking "Check again" button calls onRecheck', () => {
    const onRecheck = jest.fn();
    render(
      <ServerReachabilityNotice
        reachability="unreachable"
        onRecheck={onRecheck}
      />,
    );

    const button = screen.getByTestId('server-reachability-recheck-button');
    fireEvent.click(button);

    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  test('sr-only live region is empty for reachable', () => {
    render(<ServerReachabilityNotice reachability="reachable" />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    expect(statusRegion.textContent).toBe('');
  });

  test('sr-only live region is empty for null', () => {
    render(<ServerReachabilityNotice reachability={null} />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    expect(statusRegion.textContent).toBe('');
  });

  test('sr-only live region announces label and detail for unreachable', () => {
    render(<ServerReachabilityNotice reachability="unreachable" />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion.textContent).toContain(
      'Your other devices cannot be reached',
    );
    expect(statusRegion.textContent).toContain('You can still rotate now');
  });

  test('sr-only live region announces label and detail for signed-out', () => {
    render(<ServerReachabilityNotice reachability="signed-out" />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion.textContent).toContain('Your session has ended');
    expect(statusRegion.textContent).toContain('You can still rotate now');
  });

  test('className prop is merged onto root element', () => {
    render(
      <ServerReachabilityNotice
        reachability="unreachable"
        className="custom-class"
      />,
    );

    const root = screen.getByTestId('server-reachability-notice');
    expect(root).toHaveClass('custom-class');
    expect(root).toHaveClass('flex');
    expect(root).toHaveClass('flex-col');
  });
});
