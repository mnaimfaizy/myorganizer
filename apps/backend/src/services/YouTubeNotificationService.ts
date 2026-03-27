import winston from 'winston';
import { PrismaClient, createPrismaClient } from '../prisma';
import sendEmail from './EmailService';
import youtubeSyncService from './YouTubeSyncService';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

class YouTubeNotificationService {
  constructor(private prisma: PrismaClient) {}

  /** Run the full sync-and-notify cycle for all eligible users */
  async syncAndNotifyAll(): Promise<{
    usersSynced: number;
    notificationsSent: number;
  }> {
    let usersSynced = 0;
    let notificationsSent = 0;

    // Find all connected integrations
    const integrations = await this.prisma.youTubeIntegration.findMany({
      where: { status: 'connected' },
      select: { userId: true },
    });

    for (const { userId } of integrations) {
      try {
        // 1. Sync videos for this user
        const synced = await youtubeSyncService.syncVideosForUser(userId);
        if (synced > 0) usersSynced++;

        // 2. Check if notification is due
        const sent = await this.sendNotificationIfDue(userId);
        if (sent) notificationsSent++;
      } catch (err) {
        logger.error(`Sync/notify failed for user ${userId}: ${err}`);

        // If it's a token error, mark integration as disconnected
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (
          errorMessage.includes('invalid_grant') ||
          errorMessage.includes('Token has been expired or revoked')
        ) {
          await this.prisma.youTubeIntegration.update({
            where: { userId },
            data: { status: 'revoked' },
          });
          logger.info(`Marked integration as revoked for user ${userId}`);
        }
      }
    }

    return { usersSynced, notificationsSent };
  }

  /** Send a notification email if the user is due */
  private async sendNotificationIfDue(userId: string): Promise<boolean> {
    const settings = await this.prisma.youTubeNotificationSettings.findUnique({
      where: { userId },
    });

    if (!settings || !settings.enabled) return false;

    const now = new Date();
    const lastNotified = settings.lastNotifiedAt ?? new Date(0);
    const daysSinceLast = Math.floor(
      (now.getTime() - lastNotified.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceLast < settings.intervalDays) return false;

    // Fetch new videos since last notification
    const newVideos = await this.prisma.youTubeVideo.findMany({
      where: {
        userId,
        publishedAt: { gt: lastNotified },
        subscription: { enabled: true },
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      include: { subscription: { select: { channelTitle: true } } },
    });

    if (newVideos.length === 0) {
      // Update lastNotifiedAt even if no videos to avoid re-checking
      await this.prisma.youTubeNotificationSettings.update({
        where: { userId },
        data: { lastNotifiedAt: now },
      });
      return false;
    }

    // Get user email
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, first_name: true },
    });

    if (!user) return false;

    const html = this.buildEmailHtml(user.first_name, newVideos);
    await sendEmail(
      user.email,
      `${newVideos.length} new YouTube video${newVideos.length > 1 ? 's' : ''} from your subscriptions`,
      html,
    );

    // Mark as notified
    await this.prisma.youTubeNotificationSettings.update({
      where: { userId },
      data: { lastNotifiedAt: now },
    });

    logger.info(
      `Sent YouTube notification to ${user.email} with ${newVideos.length} videos`,
    );
    return true;
  }

  private buildEmailHtml(
    firstName: string,
    videos: Array<{
      videoId: string;
      title: string;
      thumbnail: string | null;
      publishedAt: Date;
      subscription: { channelTitle: string };
    }>,
  ): string {
    const videoRows = videos
      .map(
        (v) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <a href="https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}" style="text-decoration: none; color: #1a1a1a;">
            ${v.thumbnail ? `<img src="${v.thumbnail}" alt="" width="168" height="94" style="border-radius: 4px; margin-bottom: 4px; display: block;" />` : ''}
            <strong>${this.escapeHtml(v.title)}</strong>
          </a>
          <br/>
          <span style="color: #666; font-size: 13px;">
            ${this.escapeHtml(v.subscription.channelTitle)} &middot; ${v.publishedAt.toLocaleDateString()}
          </span>
        </td>
      </tr>`,
      )
      .join('');

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Hi ${this.escapeHtml(firstName)},</h2>
        <p style="color: #444;">Here are the latest videos from your YouTube subscriptions:</p>
        <table cellpadding="0" cellspacing="0" style="width: 100%;">
          ${videoRows}
        </table>
        <p style="margin-top: 24px; color: #666; font-size: 13px;">
          You can change your notification preferences in your MyOrganizer account settings.
        </p>
      </div>
    `;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

const youTubeNotificationService = new YouTubeNotificationService(
  createPrismaClient(),
);
export default youTubeNotificationService;
