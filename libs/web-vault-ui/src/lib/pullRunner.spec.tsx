/* eslint-disable import/first -- jest.mock must precede application imports */
import { fireEvent, render } from '@testing-library/react';

const mockRequestCheck = jest.fn();

jest.mock('@myorganizer/web-vault', () => ({
  createVaultApi: jest.fn(() => ({})),
  createVaultPullTrigger: jest.fn(() => ({
    requestCheck: mockRequestCheck,
  })),
}));

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import { createVaultApi, createVaultPullTrigger } from '@myorganizer/web-vault';
import { useOptionalVaultSession } from './session';
import { VaultPullRunner } from './pullRunner';

type MockHandle = {
  owner: string;
};

function createMockHandle(owner: string): MockHandle {
  return {
    owner,
  };
}

describe('VaultPullRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCheck.mockClear();
  });

  test('renders nothing', () => {
    const mockHandle = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    const { container } = render(<VaultPullRunner />);

    expect(container.firstChild).toBeNull();
  });

  test('does not create trigger when no session is present', () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

    render(<VaultPullRunner />);

    expect(createVaultPullTrigger).not.toHaveBeenCalled();
    expect(createVaultApi).not.toHaveBeenCalled();
  });

  test('calls requestCheck on mount with current handle', () => {
    const mockHandle = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    render(<VaultPullRunner />);

    expect(mockRequestCheck).toHaveBeenCalledTimes(1);
    expect(mockRequestCheck).toHaveBeenCalledWith(mockHandle);
  });

  test('calls requestCheck on window focus event', () => {
    const mockHandle = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    render(<VaultPullRunner />);

    // First call on mount
    expect(mockRequestCheck).toHaveBeenCalledTimes(1);

    // Trigger focus event
    fireEvent.focus(window);

    // Should have been called a second time
    expect(mockRequestCheck).toHaveBeenCalledTimes(2);
    expect(mockRequestCheck).toHaveBeenLastCalledWith(mockHandle);
  });

  test('cleans up focus listener on unmount', () => {
    const mockHandle = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
    });

    const { unmount } = render(<VaultPullRunner />);

    // First call on mount
    expect(mockRequestCheck).toHaveBeenCalledTimes(1);

    // Unmount
    unmount();

    // Trigger focus event after unmount
    fireEvent.focus(window);

    // Should still have been called only once (no additional call after unmount)
    expect(mockRequestCheck).toHaveBeenCalledTimes(1);
  });

  test('rebuilds trigger when owner changes', () => {
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    const { rerender } = render(<VaultPullRunner />);

    // Initial trigger created for user-a
    expect(createVaultPullTrigger).toHaveBeenCalledTimes(1);
    expect(mockRequestCheck).toHaveBeenCalledTimes(1);
    expect(mockRequestCheck).toHaveBeenCalledWith(handleA);

    // Reset mocks to track new calls
    mockRequestCheck.mockClear();
    (createVaultPullTrigger as jest.Mock).mockClear();

    // Change owner to user-b
    const handleB = createMockHandle('user-b');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleB,
    });

    rerender(<VaultPullRunner />);

    // New trigger should be created
    expect(createVaultPullTrigger).toHaveBeenCalledTimes(1);
    // requestCheck should be called immediately with new handle
    expect(mockRequestCheck).toHaveBeenCalledTimes(1);
    expect(mockRequestCheck).toHaveBeenCalledWith(handleB);
  });

  test('does not rebuild trigger when handle identity changes but owner stays the same', () => {
    const handleA = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
    });

    const { rerender } = render(<VaultPullRunner />);

    // Initial trigger created for user-a
    expect(createVaultPullTrigger).toHaveBeenCalledTimes(1);
    expect(mockRequestCheck).toHaveBeenCalledTimes(1);
    expect(mockRequestCheck).toHaveBeenCalledWith(handleA);

    // Reset mocks to track new calls
    mockRequestCheck.mockClear();
    (createVaultPullTrigger as jest.Mock).mockClear();

    // Provide a *different* handle object for same owner (simulating lock/unlock)
    const handleA2 = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA2,
    });

    rerender(<VaultPullRunner />);

    // Trigger should NOT be rebuilt (same owner)
    expect(createVaultPullTrigger).not.toHaveBeenCalled();

    // But requestCheck should not have been called automatically by rerender
    // (the effect is only triggered by mount or trigger change, not by handle change)
    expect(mockRequestCheck).not.toHaveBeenCalled();

    // Now trigger focus event to verify the latest handle is used
    fireEvent.focus(window);

    // requestCheck should be called with the new handle object
    expect(mockRequestCheck).toHaveBeenCalledTimes(1);
    expect(mockRequestCheck).toHaveBeenCalledWith(handleA2);
  });
});
