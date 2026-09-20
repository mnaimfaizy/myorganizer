/* eslint-disable import/first */
const mockGetAccessToken = jest.fn();
const mockGetApiBaseUrl = jest.fn(() => 'http://api.test');

jest.mock('../../hooks/useYouTubeNavVisible', () => ({
  useYouTubeNavVisible: jest.fn(),
}));

jest.mock('@myorganizer/auth', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

jest.mock('@myorganizer/core', () => ({
  getApiBaseUrl: () => mockGetApiBaseUrl(),
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { useYouTubeNavVisible } from '../../hooks/useYouTubeNavVisible';
import { RecentYouTubeCard } from './RecentYouTubeCard';

type MockResponseInit = {
  body?: unknown;
  jsonReject?: boolean;
};

function mockResponse({
  body = {},
  jsonReject = false,
}: MockResponseInit): Response {
  return {
    ok: true,
    status: 200,
    json: jsonReject
      ? jest.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
      : jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const expectedHeaders = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer test-token',
};

describe('RecentYouTubeCard', () => {
  const mockUseYouTubeNavVisible = useYouTubeNavVisible as jest.Mock;
  const fetchMock = jest.fn<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockReset();
    mockGetApiBaseUrl.mockReset();
    mockGetAccessToken.mockReturnValue('test-token');
    mockGetApiBaseUrl.mockReturnValue('http://api.test');
    mockUseYouTubeNavVisible.mockReturnValue(true);
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('availability gating', () => {
    it('renders null and skips fetch when useYouTubeNavVisible is false', async () => {
      mockUseYouTubeNavVisible.mockReturnValue(false);

      const { container } = render(<RecentYouTubeCard />);

      expect(container.firstChild).toBeNull();
      expect(
        screen.queryByText('Recent YouTube Videos'),
      ).not.toBeInTheDocument();

      await waitFor(() => {
        expect(fetchMock).not.toHaveBeenCalled();
      });
      expect(mockGetApiBaseUrl).not.toHaveBeenCalled();
      expect(mockGetAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('when availability is true', () => {
    it('shows disconnected prompt after status reports not connected', async () => {
      fetchMock.mockImplementation((url) => {
        expect(String(url)).toBe('http://api.test/youtube/status');
        return Promise.resolve(mockResponse({ body: { connected: false } }));
      });

      render(<RecentYouTubeCard />);

      expect(screen.getByText('Recent YouTube Videos')).toBeInTheDocument();
      expect(screen.getByText('Loading…')).toBeInTheDocument();

      await waitFor(() => {
        expect(
          screen.getByText('YouTube is not connected.'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByRole('link', { name: 'Connect YouTube' }),
      ).toHaveAttribute('href', '/dashboard/youtube');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('http://api.test/youtube/status', {
        headers: expectedHeaders,
        credentials: 'include',
      });
      expect(mockGetApiBaseUrl).toHaveBeenCalledTimes(1);
      expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
    });

    it('loads and renders videos when status reports connected', async () => {
      const videos = [
        {
          videoId: 'abc123',
          title: 'Test Video Title',
          thumbnail: 'https://example.com/thumb.jpg',
          publishedAt: '2024-01-15T12:00:00.000Z',
          channelTitle: 'Test Channel',
        },
      ];

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/status')) {
          return Promise.resolve(mockResponse({ body: { connected: true } }));
        }
        if (urlStr.endsWith('/videos?sort=latest&limit=6')) {
          return Promise.resolve(mockResponse({ body: { videos } }));
        }
        return Promise.reject(new Error(`unexpected fetch: ${urlStr}`));
      });

      render(<RecentYouTubeCard />);

      await waitFor(() => {
        expect(screen.getByText('Test Video Title')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Channel')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Test Video Title/i }),
      ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://api.test/youtube/status',
        {
          headers: expectedHeaders,
          credentials: 'include',
        },
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://api.test/youtube/videos?sort=latest&limit=6',
        {
          headers: expectedHeaders,
          credentials: 'include',
        },
      );
    });

    it('shows the error message when fetch rejects', async () => {
      fetchMock.mockRejectedValue(new Error('network failure'));

      render(<RecentYouTubeCard />);

      expect(screen.getByText('Loading…')).toBeInTheDocument();

      await waitFor(() => {
        expect(
          screen.getByText('Could not load videos. Try again later.'),
        ).toBeInTheDocument();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('http://api.test/youtube/status', {
        headers: expectedHeaders,
        credentials: 'include',
      });
    });
  });
});
