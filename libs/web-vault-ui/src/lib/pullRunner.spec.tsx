/* eslint-disable import/first -- jest.mock must precede application imports */
import { fireEvent, render } from '@testing-library/react';

jest.mock('./session', () => ({
  useOptionalVaultSession: jest.fn(),
}));

import { useOptionalVaultSession } from './session';
import { VaultPullRunner } from './pullRunner';

type MockHandle = {
  owner: string;
};

type MockTrigger = {
  requestCheck: jest.Mock;
};

function createMockHandle(owner: string): MockHandle {
  return { owner };
}

function createMockTrigger(): MockTrigger {
  return {
    requestCheck: jest.fn(),
  };
}

describe('VaultPullRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing', () => {
    const mockHandle = createMockHandle('user-a');
    const mockTrigger = createMockTrigger();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      pullTrigger: mockTrigger,
    });

    const { container } = render(<VaultPullRunner />);

    expect(container.firstChild).toBeNull();
  });

  test('no session — does not call requestCheck', () => {
    (useOptionalVaultSession as jest.Mock).mockReturnValue(null);

    render(<VaultPullRunner />);

    // No error, no side effects
    expect(useOptionalVaultSession).toHaveBeenCalled();
  });

  test('session with no trigger — does not call requestCheck', () => {
    const mockHandle = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      pullTrigger: null,
    });

    render(<VaultPullRunner />);

    // No error; effect early-returns
    expect(useOptionalVaultSession).toHaveBeenCalled();
  });

  test('mount with session and trigger — calls requestCheck with handle', () => {
    const mockHandle = createMockHandle('user-a');
    const mockTrigger = createMockTrigger();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      pullTrigger: mockTrigger,
    });

    render(<VaultPullRunner />);

    expect(mockTrigger.requestCheck).toHaveBeenCalledTimes(1);
    expect(mockTrigger.requestCheck).toHaveBeenCalledWith(mockHandle);
  });

  test('focus event — calls requestCheck a second time with handle', () => {
    const mockHandle = createMockHandle('user-a');
    const mockTrigger = createMockTrigger();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      pullTrigger: mockTrigger,
    });

    render(<VaultPullRunner />);

    expect(mockTrigger.requestCheck).toHaveBeenCalledTimes(1);

    fireEvent.focus(window);

    expect(mockTrigger.requestCheck).toHaveBeenCalledTimes(2);
    expect(mockTrigger.requestCheck).toHaveBeenLastCalledWith(mockHandle);
  });

  test('unmount — removes focus listener', () => {
    const mockHandle = createMockHandle('user-a');
    const mockTrigger = createMockTrigger();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      pullTrigger: mockTrigger,
    });

    const { unmount } = render(<VaultPullRunner />);

    expect(mockTrigger.requestCheck).toHaveBeenCalledTimes(1);

    unmount();

    // Focus after unmount should not call requestCheck again
    fireEvent.focus(window);

    expect(mockTrigger.requestCheck).toHaveBeenCalledTimes(1);
  });

  test('handle changes, trigger stays same — requestCheck uses latest handle', () => {
    const handleA = createMockHandle('user-a');
    const mockTrigger = createMockTrigger();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA,
      pullTrigger: mockTrigger,
    });

    const { rerender } = render(<VaultPullRunner />);

    expect(mockTrigger.requestCheck).toHaveBeenCalledTimes(1);
    expect(mockTrigger.requestCheck).toHaveBeenCalledWith(handleA);

    mockTrigger.requestCheck.mockClear();

    // New handle object, same owner, same trigger reference
    const handleA2 = createMockHandle('user-a');
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: handleA2,
      pullTrigger: mockTrigger,
    });

    rerender(<VaultPullRunner />);

    // Effect should not re-run (trigger is same reference)
    expect(mockTrigger.requestCheck).not.toHaveBeenCalled();

    // Focus event should use the new handle via handleRef
    fireEvent.focus(window);

    expect(mockTrigger.requestCheck).toHaveBeenCalledTimes(1);
    expect(mockTrigger.requestCheck).toHaveBeenCalledWith(handleA2);
  });

  test('trigger changes — effect re-runs with current handle', () => {
    const mockHandle = createMockHandle('user-a');
    const trigger1 = createMockTrigger();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      pullTrigger: trigger1,
    });

    const { rerender } = render(<VaultPullRunner />);

    expect(trigger1.requestCheck).toHaveBeenCalledTimes(1);
    expect(trigger1.requestCheck).toHaveBeenCalledWith(mockHandle);

    trigger1.requestCheck.mockClear();

    // New trigger object (simulating owner change in session)
    const trigger2 = createMockTrigger();
    (useOptionalVaultSession as jest.Mock).mockReturnValue({
      handle: mockHandle,
      pullTrigger: trigger2,
    });

    rerender(<VaultPullRunner />);

    // Effect should re-run with new trigger
    expect(trigger2.requestCheck).toHaveBeenCalledTimes(1);
    expect(trigger2.requestCheck).toHaveBeenCalledWith(mockHandle);

    // First trigger should not have been called again
    expect(trigger1.requestCheck).not.toHaveBeenCalled();
  });
});
