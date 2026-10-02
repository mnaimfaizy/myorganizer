import { renderHook, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppState } from './useAppState';

describe('useAppState hook', () => {
  let mockSubscription: { remove: jest.Mock };
  let changeListener: ((newState: AppStateStatus) => void) | null = null;
  let currentStateValue: AppStateStatus | null = 'active';
  let originalCurrentStateDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    // Save the original property descriptor so it can be restored after the test
    originalCurrentStateDescriptor = Object.getOwnPropertyDescriptor(
      AppState,
      'currentState',
    );

    // Reset the listener reference
    changeListener = null;
    currentStateValue = 'active';

    // Mock the subscription object
    mockSubscription = { remove: jest.fn() };

    // Mock AppState.currentState as a getter
    Object.defineProperty(AppState, 'currentState', {
      get: () => currentStateValue,
      configurable: true,
    });

    // Mock AppState.addEventListener to capture the listener function
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event, listener) => {
        if (event === 'change') {
          changeListener = listener as (newState: AppStateStatus) => void;
        }
        return mockSubscription;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Restore the original AppState.currentState property descriptor
    if (originalCurrentStateDescriptor !== undefined) {
      Object.defineProperty(
        AppState,
        'currentState',
        originalCurrentStateDescriptor,
      );
    } else {
      // If there was no own descriptor, delete the property
      Reflect.deleteProperty(AppState, 'currentState');
    }
  });

  describe('initial state', () => {
    it('should return "active" when AppState.currentState is "active"', async () => {
      currentStateValue = 'active';
      const { result } = await renderHook(() => useAppState());
      expect(result.current).toBe('active');
    });

    it('should return "inactive" when AppState.currentState is "inactive"', async () => {
      currentStateValue = 'inactive';
      const { result } = await renderHook(() => useAppState());
      expect(result.current).toBe('inactive');
    });

    it('should return "background" when AppState.currentState is "background"', async () => {
      currentStateValue = 'background';
      const { result } = await renderHook(() => useAppState());
      expect(result.current).toBe('background');
    });

    it('should return "unknown" when AppState.currentState is null', async () => {
      currentStateValue = null;
      const { result } = await renderHook(() => useAppState());
      expect(result.current).toBe('unknown');
    });

    it('should return "unknown" when AppState.currentState is an unrecognized string', async () => {
      currentStateValue = 'suspended' as AppStateStatus;
      const { result } = await renderHook(() => useAppState());
      expect(result.current).toBe('unknown');
    });
  });

  describe('subscription and state updates', () => {
    it('should subscribe to AppState change events on mount', async () => {
      await renderHook(() => useAppState());
      expect(AppState.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should update state when the change listener is called with a new status', async () => {
      const { result } = await renderHook(() => useAppState());
      expect(result.current).toBe('active');

      await act(async () => {
        if (changeListener) {
          changeListener('background');
        }
      });

      expect(result.current).toBe('background');
    });

    it('should call subscription.remove() on unmount', async () => {
      const { unmount } = await renderHook(() => useAppState());
      await act(async () => {
        unmount();
      });
      expect(mockSubscription.remove).toHaveBeenCalledTimes(1);
    });
  });
});
