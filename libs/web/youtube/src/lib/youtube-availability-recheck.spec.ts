import {
  onYouTubeAvailabilityRecheck,
  requestYouTubeAvailabilityRecheck,
} from './youtube-availability-recheck';

describe('youtube-availability-recheck', () => {
  it('calls each subscribed listener once per request and stops after unsubscribe', () => {
    const kept = jest.fn();
    const removed = jest.fn();
    const unsubscribeKept = onYouTubeAvailabilityRecheck(kept);
    const unsubscribeRemoved = onYouTubeAvailabilityRecheck(removed);

    requestYouTubeAvailabilityRecheck();
    expect(kept).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledTimes(1);

    unsubscribeRemoved();
    requestYouTubeAvailabilityRecheck();
    expect(kept).toHaveBeenCalledTimes(2);
    expect(removed).toHaveBeenCalledTimes(1);

    unsubscribeKept();
  });
});
