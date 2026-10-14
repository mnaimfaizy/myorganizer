import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import userService from './UserService';
import youtubeAccessService from './YouTubeAccessService';
import youtubeSyncService from './YouTubeSyncService';

jest.mock('./UserService', () => ({
  __esModule: true,
  default: {
    withdrawYouTubeAccessGrant: jest.fn(),
  },
}));

// The real YouTubeSyncService is not loaded here because it pulls in the
// Google and sync stack. The factory keeps the literal below; it mirrors
// NO_YOUTUBE_INTEGRATION_MESSAGE in apps/backend/src/services/YouTubeSyncService.ts.
jest.mock('./YouTubeSyncService', () => ({
  __esModule: true,
  default: {
    disconnect: jest.fn(),
  },
  NO_YOUTUBE_INTEGRATION_MESSAGE: 'No YouTube integration found.',
}));

const ACTOR_ID = 'actor-1';
const TARGET_ID = 'target-1';
// Same literal as the mock factory above; mirrors NO_YOUTUBE_INTEGRATION_MESSAGE.
const NO_INTEGRATION_MESSAGE = 'No YouTube integration found.';

const withdrawGrant = jest.mocked(userService.withdrawYouTubeAccessGrant);
const disconnect = jest.mocked(youtubeSyncService.disconnect);

const withdrawnUser = {
  id: TARGET_ID,
  name: 'Target User',
  first_name: 'Target',
  last_name: 'User',
  phone: null,
  email: 'target@example.com',
  role: 'user',
  disabled: false,
  email_verification_timestamp: null,
  youtube_access: false,
};

describe('YouTubeAccessService.withdrawYouTubeAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    withdrawGrant.mockResolvedValue(withdrawnUser as never);
  });

  test('clears the grant, disconnects a connected User, and reports completed', async () => {
    disconnect.mockResolvedValue({
      ok: true,
      message: 'YouTube account disconnected.',
    });

    const result = await youtubeAccessService.withdrawYouTubeAccess(
      ACTOR_ID,
      TARGET_ID,
    );

    expect(result).toEqual({
      user: withdrawnUser,
      youtubeDisconnect: 'completed',
    });
    expect(withdrawGrant).toHaveBeenCalledWith(ACTOR_ID, TARGET_ID);
    expect(disconnect).toHaveBeenCalledWith(TARGET_ID);
  });

  test('reports pending when a Sync Run is live, after the grant is already cleared', async () => {
    disconnect.mockResolvedValue({
      ok: false,
      code: 'sync_run_live',
      message: 'A sync is running.',
    });

    const result = await youtubeAccessService.withdrawYouTubeAccess(
      ACTOR_ID,
      TARGET_ID,
    );

    expect(result).toEqual({
      user: withdrawnUser,
      youtubeDisconnect: 'pending',
    });
    expect(withdrawGrant.mock.invocationCallOrder[0]).toBeLessThan(
      disconnect.mock.invocationCallOrder[0],
    );
  });

  test('reports not_connected when the User has no YouTube integration', async () => {
    disconnect.mockResolvedValue({
      ok: false,
      message: NO_INTEGRATION_MESSAGE,
    });

    const result = await youtubeAccessService.withdrawYouTubeAccess(
      ACTOR_ID,
      TARGET_ID,
    );

    expect(result).toEqual({
      user: withdrawnUser,
      youtubeDisconnect: 'not_connected',
    });
  });

  test('rejects on any other disconnect failure', async () => {
    disconnect.mockResolvedValue({
      ok: false,
      message: 'Token store unavailable.',
    });

    await expect(
      youtubeAccessService.withdrawYouTubeAccess(ACTOR_ID, TARGET_ID),
    ).rejects.toThrow('YouTube Disconnect failed: Token store unavailable.');
    expect(withdrawGrant).toHaveBeenCalledWith(ACTOR_ID, TARGET_ID);
  });
});
