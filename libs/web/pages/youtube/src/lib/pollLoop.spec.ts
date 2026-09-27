import { startPollLoop } from './pollLoop';

const INTERVAL_MS = 1000;

describe('startPollLoop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('non-leading: no poll at start; first poll after intervalMs; subsequent polls every intervalMs', async () => {
    const poll = jest.fn().mockResolvedValue('result');

    startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: false,
    });

    // No poll on call
    expect(poll).not.toHaveBeenCalled();

    // First poll after intervalMs
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);

    // Second poll after another intervalMs
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('leading: poll called immediately, then after each intervalMs', async () => {
    const poll = jest.fn().mockResolvedValue('result');

    startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: true,
    });

    // Poll called immediately
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);

    // Second poll after intervalMs
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(2);

    // Third poll after another intervalMs
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it('awaits each poll: advancing time while poll is pending does not start another poll', async () => {
    let resolvePoll: (value: string) => void = () => undefined;
    const poll = jest.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePoll = resolve;
        }),
    );

    startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: true,
    });

    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);

    // Advance time well past intervalMs while poll is still pending
    jest.advanceTimersByTime(INTERVAL_MS * 3);
    await Promise.resolve();

    // Poll should still only be called once (not multiple times from the advances)
    expect(poll).toHaveBeenCalledTimes(1);

    // Now resolve the pending poll
    resolvePoll('result');
    await Promise.resolve();

    // After resolving, the next poll should be scheduled and can fire
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('poll rejection: onResult receives undefined and loop continues', async () => {
    const poll = jest.fn().mockRejectedValue(new Error('poll failed'));
    const onResult = jest.fn().mockReturnValue(true);

    startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: true,
      onResult,
    });

    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(undefined);

    // Loop continues: advance time and poll again
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  it('onResult returning false: loop stops immediately, no further polls', async () => {
    const poll = jest.fn().mockResolvedValue('result');
    const onResult = jest.fn().mockReturnValue(false);

    startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: true,
      onResult,
    });

    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);

    // Advance time: no more polls should occur
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('onResult returning true: loop continues with scheduled polls', async () => {
    const poll = jest.fn().mockResolvedValue('result');
    const onResult = jest.fn().mockReturnValue(true);

    startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: true,
      onResult,
    });

    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);

    // Advance and verify loop continues
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it('omitted onResult: loop continues indefinitely', async () => {
    const poll = jest.fn().mockResolvedValue('result');

    startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: true,
      // onResult omitted
    });

    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it('cancel before first tick: no poll ever runs', async () => {
    const poll = jest.fn().mockResolvedValue('result');

    const cancel = startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: false,
    });

    // Cancel immediately before any poll
    cancel();

    // Advance past the interval
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();

    // Poll should never have been called
    expect(poll).not.toHaveBeenCalled();
  });

  it('cancel while poll in flight: when poll resolves, onResult not called and no further poll scheduled', async () => {
    let resolvePoll: (value: string) => void = () => undefined;
    const poll = jest.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePoll = resolve;
        }),
    );
    const onResult = jest.fn().mockReturnValue(true);

    const cancel = startPollLoop({
      poll,
      intervalMs: INTERVAL_MS,
      leading: true,
      onResult,
    });

    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled(); // Poll still pending

    // Cancel the loop while poll is in flight
    cancel();

    // Resolve the pending poll
    resolvePoll('result');
    await Promise.resolve();

    // onResult should not be called (cancelled before poll resolved)
    expect(onResult).not.toHaveBeenCalled();

    // Advance time: no new poll should be scheduled
    jest.advanceTimersByTime(INTERVAL_MS);
    await Promise.resolve();
    expect(poll).toHaveBeenCalledTimes(1);
  });
});
