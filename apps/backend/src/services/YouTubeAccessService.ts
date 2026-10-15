import type { YouTubeDisconnectOutcome } from '../types';
import userService, { AdminIdentityUser } from './UserService';
import youtubeSyncService, {
  NO_YOUTUBE_INTEGRATION_MESSAGE,
} from './YouTubeSyncService';

export interface WithdrawYouTubeAccessOutcome {
  user: AdminIdentityUser;
  youtubeDisconnect: YouTubeDisconnectOutcome;
}

/**
 * Orchestrates YouTube Access withdrawal (ADR 0129): clears the grant and
 * audit row in UserService, then performs the YouTube Disconnect. Kept apart
 * from UserService so the auth middleware's import of UserService does not
 * pull in the YouTube sync stack.
 */
class YouTubeAccessService {
  async withdrawYouTubeAccess(
    actorUserId: string,
    targetUserId: string,
  ): Promise<WithdrawYouTubeAccessOutcome> {
    const user = await userService.withdrawYouTubeAccessGrant(
      actorUserId,
      targetUserId,
    );

    const result = await youtubeSyncService.disconnect(targetUserId);
    if (result.ok === true) {
      return { user, youtubeDisconnect: 'completed' };
    }
    if (result.code === 'sync_run_live') {
      return { user, youtubeDisconnect: 'pending' };
    }
    if (result.message === NO_YOUTUBE_INTEGRATION_MESSAGE) {
      return { user, youtubeDisconnect: 'not_connected' };
    }
    throw new Error(`YouTube Disconnect failed: ${result.message}`);
  }
}

const youtubeAccessService = new YouTubeAccessService();
export default youtubeAccessService;
