import { Env, isYouTubeAvailable } from './youtube';

/**
 * Boot-time guard for ADR 0091. When YouTube is available in production,
 * GOOGLE_REDIRECT_URI must be https, must not point at localhost, and must
 * share APP_FRONTEND_URL's origin. Throws to stop the process from starting
 * rather than serving a misconfigured OAuth redirect; never runs outside
 * production or with the switch off, because those values live in GitHub
 * Environment secrets no repository gate can read.
 */
export function validateGoogleRedirectUriOnBoot(env: Env = process.env): void {
  const isProduction = env.NODE_ENV === 'production';
  if (!isProduction || !isYouTubeAvailable(env)) return;

  const redirectUriRaw = (env.GOOGLE_REDIRECT_URI ?? '').trim();
  if (!redirectUriRaw) {
    throw new Error(
      '[youtube] GOOGLE_REDIRECT_URI is required in production when YouTube is available.',
    );
  }

  let redirectUri: URL;
  try {
    redirectUri = new URL(redirectUriRaw);
  } catch {
    throw new Error(
      '[youtube] GOOGLE_REDIRECT_URI must be a valid absolute URL.',
    );
  }

  if (redirectUri.protocol !== 'https:') {
    throw new Error(
      '[youtube] GOOGLE_REDIRECT_URI must use https in production.',
    );
  }

  if (redirectUri.hostname.toLowerCase() === 'localhost') {
    throw new Error(
      '[youtube] GOOGLE_REDIRECT_URI must not point at localhost in production.',
    );
  }

  const frontendUrlRaw = (env.APP_FRONTEND_URL ?? '').trim();
  if (!frontendUrlRaw) {
    throw new Error(
      "[youtube] APP_FRONTEND_URL must be set to validate GOOGLE_REDIRECT_URI against the app's origin.",
    );
  }

  let frontendUrl: URL;
  try {
    frontendUrl = new URL(frontendUrlRaw);
  } catch {
    throw new Error('[youtube] APP_FRONTEND_URL must be a valid absolute URL.');
  }

  if (redirectUri.origin !== frontendUrl.origin) {
    throw new Error(
      "[youtube] GOOGLE_REDIRECT_URI must share the app's configured frontend origin.",
    );
  }
}
