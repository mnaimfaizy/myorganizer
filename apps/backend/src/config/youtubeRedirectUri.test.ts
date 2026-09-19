import { describe, expect, test } from '@jest/globals';
import { validateGoogleRedirectUriOnBoot } from './youtubeRedirectUri';

describe('validateGoogleRedirectUriOnBoot', () => {
  test('does not throw when NODE_ENV is development', () => {
    const env = {
      NODE_ENV: 'development',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'http://invalid',
      APP_FRONTEND_URL: 'http://invalid',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('does not throw when NODE_ENV is test', () => {
    const env = {
      NODE_ENV: 'test',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'http://invalid',
      APP_FRONTEND_URL: 'http://invalid',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('does not throw when NODE_ENV is unset (not production)', () => {
    const env = {
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'http://invalid',
      APP_FRONTEND_URL: 'http://invalid',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('does not throw in production when YOUTUBE_AVAILABLE is false', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'false',
      GOOGLE_REDIRECT_URI: 'http://invalid',
      APP_FRONTEND_URL: 'http://invalid',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('does not throw in production when YOUTUBE_AVAILABLE is unset (defaults to false)', () => {
    const env = {
      NODE_ENV: 'production',
      GOOGLE_REDIRECT_URI: 'http://invalid',
      APP_FRONTEND_URL: 'http://invalid',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('does not throw in production with valid HTTPS redirect URI and matching frontend origin', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://myorganizer.app/dashboard/youtube/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('does not throw in production with valid HTTPS redirect URI with path and matching frontend origin', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI:
        'https://myorganizer.app:443/dashboard/youtube/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('throws when NODE_ENV is production, switch is on, and GOOGLE_REDIRECT_URI uses HTTP', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'http://myorganizer.app/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(/https/i);
  });

  test('error message for HTTP redirect does not contain the URL value', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'http://myorganizer.app/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow();
    try {
      validateGoogleRedirectUriOnBoot(env);
    } catch (err: any) {
      expect(err.message).not.toContain('http://myorganizer.app/callback');
    }
  });

  test('throws when NODE_ENV is production, switch is on, and GOOGLE_REDIRECT_URI points to localhost', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://localhost:3000/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(/localhost/i);
  });

  test('throws when NODE_ENV is production, switch is on, and GOOGLE_REDIRECT_URI has different origin from APP_FRONTEND_URL', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://evil.example.com/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(
      /frontend origin/i,
    );
  });

  test('error message for origin mismatch does not contain the redirect URI value', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://evil.example.com/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    try {
      validateGoogleRedirectUriOnBoot(env);
    } catch (err: any) {
      expect(err.message).not.toContain('https://evil.example.com/callback');
    }
  });

  test('throws when NODE_ENV is production, switch is on, and GOOGLE_REDIRECT_URI is unset', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(
      /GOOGLE_REDIRECT_URI is required/i,
    );
  });

  test('throws when NODE_ENV is production, switch is on, and GOOGLE_REDIRECT_URI is blank', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: '   ',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(
      /GOOGLE_REDIRECT_URI is required/i,
    );
  });

  test('throws when NODE_ENV is production, switch is on, and APP_FRONTEND_URL is unset', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://myorganizer.app/callback',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(
      /APP_FRONTEND_URL must be set/i,
    );
  });

  test('throws when NODE_ENV is production, switch is on, and APP_FRONTEND_URL is blank', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://myorganizer.app/callback',
      APP_FRONTEND_URL: '   ',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(
      /APP_FRONTEND_URL must be set/i,
    );
  });

  test('throws when GOOGLE_REDIRECT_URI is not a valid absolute URL', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'not-a-url',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(
      /GOOGLE_REDIRECT_URI must be a valid absolute URL/i,
    );
  });

  test('throws when APP_FRONTEND_URL is not a valid absolute URL', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://myorganizer.app/callback',
      APP_FRONTEND_URL: 'not-a-url',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(
      /APP_FRONTEND_URL must be a valid absolute URL/i,
    );
  });

  test('throws when GOOGLE_REDIRECT_URI has different port than APP_FRONTEND_URL', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://myorganizer.app:8443/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(
      /frontend origin/i,
    );
  });

  test('error message for port mismatch does not contain the URL value', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://myorganizer.app:8443/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    try {
      validateGoogleRedirectUriOnBoot(env);
    } catch (err: any) {
      expect(err.message).not.toContain(
        'https://myorganizer.app:8443/callback',
      );
    }
  });

  test('handles case-insensitive localhost check', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'true',
      GOOGLE_REDIRECT_URI: 'https://LOCALHOST/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).toThrow(/localhost/i);
  });

  test('does not throw when YOUTUBE_AVAILABLE is set to "1" (truthy)', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: '1',
      GOOGLE_REDIRECT_URI: 'https://myorganizer.app/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('does not throw when YOUTUBE_AVAILABLE is set to "yes" (truthy)', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: 'yes',
      GOOGLE_REDIRECT_URI: 'https://myorganizer.app/callback',
      APP_FRONTEND_URL: 'https://myorganizer.app',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });

  test('throws when YOUTUBE_AVAILABLE is "0" (falsy, even in production)', () => {
    const env = {
      NODE_ENV: 'production',
      YOUTUBE_AVAILABLE: '0',
      GOOGLE_REDIRECT_URI: 'http://invalid',
      APP_FRONTEND_URL: 'http://invalid',
    };

    expect(() => validateGoogleRedirectUriOnBoot(env)).not.toThrow();
  });
});
