/* eslint-disable import/first */
jest.mock('@myorganizer/web-youtube', () => ({
  useYouTubeAvailability: jest.fn(),
}));

import { renderHook } from '@testing-library/react';
import { useYouTubeAvailability } from '@myorganizer/web-youtube';
import { useYouTubeNavVisible } from './useYouTubeNavVisible';

const mockUseYouTubeAvailability = useYouTubeAvailability as jest.Mock;

describe('useYouTubeNavVisible', () => {
  beforeEach(() => {
    mockUseYouTubeAvailability.mockReset();
  });

  it('returns false while availability is null (loading)', () => {
    mockUseYouTubeAvailability.mockReturnValue({
      available: null,
      loading: true,
      error: null,
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    expect(result.current).toBe(false);
    expect(mockUseYouTubeAvailability).toHaveBeenCalledTimes(1);
  });

  it('returns true when available is strictly true', () => {
    mockUseYouTubeAvailability.mockReturnValue({
      available: true,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    expect(result.current).toBe(true);
    expect(mockUseYouTubeAvailability).toHaveBeenCalledTimes(1);
  });

  it('returns false when available is false', () => {
    mockUseYouTubeAvailability.mockReturnValue({
      available: false,
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    expect(result.current).toBe(false);
  });

  it('returns false when an error is present', () => {
    mockUseYouTubeAvailability.mockReturnValue({
      available: false,
      loading: false,
      error: new Error('network failure'),
    });

    const { result } = renderHook(() => useYouTubeNavVisible());

    expect(result.current).toBe(false);
  });
});
