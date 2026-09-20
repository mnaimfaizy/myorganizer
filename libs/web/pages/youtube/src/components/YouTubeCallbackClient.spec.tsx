/* eslint-disable import/first */
const mockReplace = jest.fn();
const mockSearchParams = { value: new URLSearchParams('code=test-auth-code') };
const mockUseYouTubeAvailability = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams.value,
}));

jest.mock('../hooks', () => ({
  useYouTubeAvailability: () => mockUseYouTubeAvailability(),
}));

jest.mock('@myorganizer/auth', () => ({
  getAccessToken: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { getAccessToken } from '@myorganizer/auth';
import YouTubeCallbackClient from './YouTubeCallbackClient';

describe('YouTubeCallbackClient — fail-closed availability', () => {
  const mockGetAccessToken = getAccessToken as jest.Mock;
  const fetchMock = jest.fn<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace.mockClear();
    mockSearchParams.value = new URLSearchParams('code=test-auth-code');
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('when available=false', () => {
    beforeEach(() => {
      mockUseYouTubeAvailability.mockReturnValue({
        available: false,
        loading: false,
        error: null,
      });
    });

    it('renders unavailable messaging instead of the loading screen', () => {
      render(<YouTubeCallbackClient />);

      expect(
        screen.getByText('YouTube is not available right now.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Please try again later.')).toBeInTheDocument();
      expect(
        screen.queryByText(/Connecting your YouTube account/),
      ).not.toBeInTheDocument();
    });

    it('does not run OAuth exchange side effects', async () => {
      render(<YouTubeCallbackClient />);

      await waitFor(() => {
        expect(fetchMock).not.toHaveBeenCalled();
      });
      expect(mockGetAccessToken).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalledWith('/dashboard/youtube');
    });
  });

  describe('when available=null', () => {
    beforeEach(() => {
      mockUseYouTubeAvailability.mockReturnValue({
        available: null,
        loading: true,
        error: null,
      });
    });

    it('renders fail-closed unavailable state instead of the loading screen', () => {
      render(<YouTubeCallbackClient />);

      expect(
        screen.getByText('YouTube is not available right now.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Please try again later.')).toBeInTheDocument();
      expect(
        screen.queryByText(/Connecting your YouTube account/),
      ).not.toBeInTheDocument();
    });

    it('does not run OAuth exchange side effects', async () => {
      render(<YouTubeCallbackClient />);

      await waitFor(() => {
        expect(fetchMock).not.toHaveBeenCalled();
      });
      expect(mockGetAccessToken).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalledWith('/dashboard/youtube');
    });
  });

  describe('unavailable state navigation', () => {
    beforeEach(() => {
      mockUseYouTubeAvailability.mockReturnValue({
        available: false,
        loading: false,
        error: null,
      });
    });

    it('calls router.replace("/dashboard") when Back to Dashboard is clicked', () => {
      render(<YouTubeCallbackClient />);

      fireEvent.click(
        screen.getByRole('button', { name: /Back to Dashboard/i }),
      );

      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
      expect(mockReplace).toHaveBeenCalledTimes(1);
    });
  });
});
