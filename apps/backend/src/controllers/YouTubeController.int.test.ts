import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';
import bodyParser from 'body-parser';
import express from 'express';
import request from 'supertest';
import { ValidateError } from 'tsoa';

jest.setTimeout(30_000);

jest.mock('../helpers/PlatformTokenHandler', () => ({
  __esModule: true,
  PlatformTokenHandler: {
    issueLoginSession: jest.fn(),
  },
  default: {
    issueLoginSession: jest.fn(),
  },
}));

jest.mock('../utils/passport', () => ({
  __esModule: true,
  default: {
    authenticate: () => (_req: any, _res: any, next: any) => next(),
  },
}));

const CRON_SECRET = 'test-youtube-cron-secret';

jest.mock('../middleware/authentication', () => {
  return {
    expressAuthentication: async (req: any, securityName: string) => {
      if (securityName === 'cron-secret') {
        const secret = req.headers['x-cron-secret'];
        const expectedSecret = process.env.YOUTUBE_CRON_SECRET;

        if (!expectedSecret || secret !== expectedSecret) {
          const err = new Error('Unauthorized') as Error & { status?: number };
          err.status = 401;
          throw err;
        }

        return;
      }

      const authHeader = req?.headers?.authorization;
      if (!authHeader) {
        const err = new Error('Unauthorized') as Error & { status?: number };
        err.status = 401;
        throw err;
      }

      req.user = { id: 'user-1' };
      return req.user;
    },
  };
});

jest.mock('../services/VaultService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/VaultBackupService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/UserService', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../services/YouTubeSyncService', () => ({
  __esModule: true,
  default: {
    getAuthUrl: jest.fn(),
    handleOAuthCallback: jest.fn(),
    getStatus: jest.fn(),
    disconnect: jest.fn(),
    getSubscriptions: jest.fn(),
    manualRefresh: jest.fn(),
    getVideos: jest.fn(),
    getNotificationSettings: jest.fn(),
    updateNotificationSettings: jest.fn(),
    getSyncStatus: jest.fn(),
    toggleSubscription: jest.fn(),
    setVideoWatched: jest.fn(),
    getVideosGroupedByChannel: jest.fn(),
  },
}));

jest.mock('../services/YouTubeSyncWorkerService', () => ({
  __esModule: true,
  default: {
    runSyncWorker: jest.fn(),
  },
}));

jest.mock('../services/YouTubeDigestService', () => ({
  __esModule: true,
  default: {
    runDigestWorker: jest.fn(),
    unsubscribe: jest.fn(),
  },
}));

function makeApp() {
  jest.resetModules();

  const { RegisterRoutes } = require('../routes/routes');
  const {
    createYouTubeAvailabilityGate,
  } = require('../middleware/youtubeAvailabilityGate');

  const app = express();
  app.use(bodyParser.json({ limit: '2mb' }));
  app.use('/youtube', createYouTubeAvailabilityGate());
  RegisterRoutes(app);

  app.use(function tsoaErrorHandler(
    err: unknown,
    _req: any,
    res: any,
    next: any,
  ) {
    if (err instanceof ValidateError) {
      return res.status(422).json({
        message: 'Validation Failed',
        details: err?.fields,
      });
    }

    const anyErr = err as { status?: number; message?: string };
    if (
      anyErr &&
      typeof anyErr === 'object' &&
      typeof anyErr.status === 'number'
    ) {
      return res.status(anyErr.status).json({ message: anyErr.message });
    }

    if (err instanceof Error) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    return next(err);
  });

  return app;
}

describe('YouTubeController (HTTP integration)', () => {
  const originalCronSecret = process.env.YOUTUBE_CRON_SECRET;
  const originalYouTubeAvailable = process.env.YOUTUBE_AVAILABLE;
  let app: express.Application;

  beforeAll(() => {
    app = makeApp();
  });

  beforeEach(() => {
    process.env.YOUTUBE_CRON_SECRET = CRON_SECRET;
    process.env.YOUTUBE_AVAILABLE = 'true';
    jest.resetAllMocks();
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.YOUTUBE_CRON_SECRET;
    } else {
      process.env.YOUTUBE_CRON_SECRET = originalCronSecret;
    }
    if (originalYouTubeAvailable === undefined) {
      delete process.env.YOUTUBE_AVAILABLE;
    } else {
      process.env.YOUTUBE_AVAILABLE = originalYouTubeAvailable;
    }
  });

  test('requires auth for GET /youtube/auth-url', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app).get('/youtube/auth-url');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youtubeSyncService.getAuthUrl).not.toHaveBeenCalled();
  });

  test('returns auth URL for authenticated GET /youtube/auth-url', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    youtubeSyncService.getAuthUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/auth?state=user-1',
    );

    const res = await request(app)
      .get('/youtube/auth-url')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: 'https://accounts.google.com/o/oauth2/auth?state=user-1',
    });
    expect(youtubeSyncService.getAuthUrl).toHaveBeenCalledWith('user-1');
  });

  test('requires X-Cron-Secret for POST /youtube/cron/sync', async () => {
    const youTubeSyncWorkerService =
      require('../services/YouTubeSyncWorkerService').default;

    const res = await request(app).post('/youtube/cron/sync');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youTubeSyncWorkerService.runSyncWorker).not.toHaveBeenCalled();
  });

  test('rejects wrong X-Cron-Secret for POST /youtube/cron/sync', async () => {
    const youTubeSyncWorkerService =
      require('../services/YouTubeSyncWorkerService').default;

    const res = await request(app)
      .post('/youtube/cron/sync')
      .set('X-Cron-Secret', 'wrong-secret');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youTubeSyncWorkerService.runSyncWorker).not.toHaveBeenCalled();
  });

  test('runs cron sync with valid X-Cron-Secret', async () => {
    const youTubeSyncWorkerService =
      require('../services/YouTubeSyncWorkerService').default;

    youTubeSyncWorkerService.runSyncWorker.mockResolvedValue({
      ran: true,
      processed: 10,
      usersSynced: 8,
      failed: 2,
      done: false,
    });

    const res = await request(app)
      .post('/youtube/cron/sync')
      .set('X-Cron-Secret', CRON_SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ran: true,
      processed: 10,
      usersSynced: 8,
      failed: 2,
      done: false,
    });
    expect(youTubeSyncWorkerService.runSyncWorker).toHaveBeenCalledTimes(1);
  });

  test('requires X-Cron-Secret for POST /youtube/cron/digest', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    const res = await request(app).post('/youtube/cron/digest');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youTubeDigestService.runDigestWorker).not.toHaveBeenCalled();
  });

  test('rejects wrong X-Cron-Secret for POST /youtube/cron/digest', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    const res = await request(app)
      .post('/youtube/cron/digest')
      .set('X-Cron-Secret', 'wrong-secret');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youTubeDigestService.runDigestWorker).not.toHaveBeenCalled();
  });

  test('runs cron digest with valid X-Cron-Secret', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    youTubeDigestService.runDigestWorker.mockResolvedValue({
      ran: true,
      processed: 25,
      sent: 18,
      skippedEmpty: 4,
      notDue: 2,
      duplicates: 1,
      failed: 0,
      done: false,
    });

    const res = await request(app)
      .post('/youtube/cron/digest')
      .set('X-Cron-Secret', CRON_SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ran: true,
      processed: 25,
      sent: 18,
      skippedEmpty: 4,
      notDue: 2,
      duplicates: 1,
      failed: 0,
      done: false,
    });
    expect(youTubeDigestService.runDigestWorker).toHaveBeenCalledTimes(1);
  });

  test('unsubscribes from digest with valid token (no auth headers)', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    youTubeDigestService.unsubscribe.mockResolvedValue(true);

    const res = await request(app)
      .post('/youtube/digest/unsubscribe')
      .send({ token: 'valid-unsubscribe-token' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(youTubeDigestService.unsubscribe).toHaveBeenCalledWith(
      'valid-unsubscribe-token',
    );
  });

  test('returns 404 when unsubscribe token is invalid (no auth headers)', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    youTubeDigestService.unsubscribe.mockResolvedValue(false);

    const res = await request(app)
      .post('/youtube/digest/unsubscribe')
      .send({ token: 'invalid-token' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Unknown unsubscribe link.' });
    expect(youTubeDigestService.unsubscribe).toHaveBeenCalledWith(
      'invalid-token',
    );
  });

  test('returns identical 401 body shape for JWT and cron-secret auth failures', async () => {
    const jwtRes = await request(app).get('/youtube/auth-url');
    const cronRes = await request(app).post('/youtube/cron/sync');

    expect(jwtRes.status).toBe(401);
    expect(cronRes.status).toBe(401);
    expect(jwtRes.body).toEqual({ message: 'Unauthorized' });
    expect(cronRes.body).toEqual({ message: 'Unauthorized' });
    expect(Object.keys(jwtRes.body).sort()).toEqual(
      Object.keys(cronRes.body).sort(),
    );
  });

  test('GET /youtube/availability returns true when switch is on', async () => {
    const res = await request(app).get('/youtube/availability');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true });
  });
});

describe('YouTube availability switch — off', () => {
  const originalCronSecret = process.env.YOUTUBE_CRON_SECRET;
  const originalYouTubeAvailable = process.env.YOUTUBE_AVAILABLE;
  let app: express.Application;

  beforeAll(() => {
    app = makeApp();
  });

  beforeEach(() => {
    process.env.YOUTUBE_CRON_SECRET = CRON_SECRET;
    process.env.YOUTUBE_AVAILABLE = 'false';
    jest.resetAllMocks();
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.YOUTUBE_CRON_SECRET;
    } else {
      process.env.YOUTUBE_CRON_SECRET = originalCronSecret;
    }
    if (originalYouTubeAvailable === undefined) {
      delete process.env.YOUTUBE_AVAILABLE;
    } else {
      process.env.YOUTUBE_AVAILABLE = originalYouTubeAvailable;
    }
  });

  test('GET /youtube/auth-url returns 404 when switch is off', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app)
      .get('/youtube/auth-url')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youtubeSyncService.getAuthUrl).not.toHaveBeenCalled();
  });

  test('POST /youtube/callback returns 404 when switch is off', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app)
      .post('/youtube/callback')
      .set('Authorization', 'Bearer test')
      .send({ code: 'auth-code' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youtubeSyncService.handleOAuthCallback).not.toHaveBeenCalled();
  });

  test('GET /youtube/status returns 404 when switch is off', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app)
      .get('/youtube/status')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youtubeSyncService.getStatus).not.toHaveBeenCalled();
  });

  test('DELETE /youtube/disconnect returns 404 when switch is off', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app)
      .delete('/youtube/disconnect')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youtubeSyncService.disconnect).not.toHaveBeenCalled();
  });

  test('GET /youtube/subscriptions returns 404 when switch is off', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app)
      .get('/youtube/subscriptions')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youtubeSyncService.getSubscriptions).not.toHaveBeenCalled();
  });

  test('PUT /youtube/subscriptions/sync returns 404 when switch is off', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app)
      .put('/youtube/subscriptions/sync')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youtubeSyncService.manualRefresh).not.toHaveBeenCalled();
  });

  test('GET /youtube/videos returns 404 when switch is off', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app)
      .get('/youtube/videos')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youtubeSyncService.getVideos).not.toHaveBeenCalled();
  });

  test('GET /youtube/notification-settings returns 404 when switch is off', async () => {
    const youtubeSyncService =
      require('../services/YouTubeSyncService').default;

    const res = await request(app)
      .get('/youtube/notification-settings')
      .set('Authorization', 'Bearer test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youtubeSyncService.getNotificationSettings).not.toHaveBeenCalled();
  });

  test('POST /youtube/digest/unsubscribe returns 404 when switch is off', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    const res = await request(app)
      .post('/youtube/digest/unsubscribe')
      .send({ token: 'unsubscribe-token' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not Found' });
    expect(youTubeDigestService.unsubscribe).not.toHaveBeenCalled();
  });

  test('POST /youtube/cron/sync returns 200 with no-op body when switch is off', async () => {
    const youTubeSyncWorkerService =
      require('../services/YouTubeSyncWorkerService').default;

    const res = await request(app)
      .post('/youtube/cron/sync')
      .set('X-Cron-Secret', CRON_SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ran: false,
      processed: 0,
      usersSynced: 0,
      failed: 0,
      done: true,
    });
    expect(youTubeSyncWorkerService.runSyncWorker).not.toHaveBeenCalled();
  });

  test('POST /youtube/cron/sync returns 401 on missing X-Cron-Secret when switch is off', async () => {
    const youTubeSyncWorkerService =
      require('../services/YouTubeSyncWorkerService').default;

    const res = await request(app).post('/youtube/cron/sync');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youTubeSyncWorkerService.runSyncWorker).not.toHaveBeenCalled();
  });

  test('POST /youtube/cron/sync returns 401 on wrong X-Cron-Secret when switch is off', async () => {
    const youTubeSyncWorkerService =
      require('../services/YouTubeSyncWorkerService').default;

    const res = await request(app)
      .post('/youtube/cron/sync')
      .set('X-Cron-Secret', 'wrong-secret');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youTubeSyncWorkerService.runSyncWorker).not.toHaveBeenCalled();
  });

  test('POST /youtube/cron/digest returns 200 with no-op body when switch is off', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    const res = await request(app)
      .post('/youtube/cron/digest')
      .set('X-Cron-Secret', CRON_SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ran: false,
      processed: 0,
      sent: 0,
      skippedEmpty: 0,
      notDue: 0,
      duplicates: 0,
      failed: 0,
      done: true,
    });
    expect(youTubeDigestService.runDigestWorker).not.toHaveBeenCalled();
  });

  test('POST /youtube/cron/digest returns 401 on missing X-Cron-Secret when switch is off', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    const res = await request(app).post('/youtube/cron/digest');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youTubeDigestService.runDigestWorker).not.toHaveBeenCalled();
  });

  test('POST /youtube/cron/digest returns 401 on wrong X-Cron-Secret when switch is off', async () => {
    const youTubeDigestService =
      require('../services/YouTubeDigestService').default;

    const res = await request(app)
      .post('/youtube/cron/digest')
      .set('X-Cron-Secret', 'wrong-secret');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
    expect(youTubeDigestService.runDigestWorker).not.toHaveBeenCalled();
  });

  test('GET /youtube/availability returns false when switch is off', async () => {
    const res = await request(app).get('/youtube/availability');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });
});
