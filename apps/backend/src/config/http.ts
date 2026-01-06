import type { CorsOptions } from 'cors';

const DEFAULT_CORS_ORIGINS = [
  'https://myorganizerapi.mnfprofile.com',
  'https://myorganiser.app',
  'https://www.myorganiser.app',
  'https://api.myorganiser.app',
  'http://localhost:3000',
  'http://localhost:4200',
];

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

export function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

export function getAllowedCorsOrigins(): string[] {
  const fromEnv = parseCorsOrigins(process.env.CORS_ORIGINS);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_CORS_ORIGINS;
}

export function createCorsOptions(): CorsOptions {
  const allowedOrigins = getAllowedCorsOrigins();

  return {
    origin: (origin, callback) => {
      // Allow requests without Origin header (curl, server-to-server).
      if (!origin) return callback(null, true);

      const normalized = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalized)) return callback(null, true);

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'If-Match'],
    exposedHeaders: ['ETag'],
  };
}

export function getSessionSecret(): string {
  const secret = (process.env.SESSION_SECRET || '').trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }

  // Dev/test fallback.
  return 'secret';
}
