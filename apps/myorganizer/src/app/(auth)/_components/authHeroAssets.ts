import type { AuthHeroScreen } from './authHero';

/**
 * Optimized hero images under /public/images/auth.
 * Prefer .webp; .jpg is the fallback for older browsers.
 */
export type AuthHeroAsset = {
  webp: string;
  jpg: string;
  alt: string;
};

export const AUTH_HERO_ASSETS: Partial<Record<AuthHeroScreen, AuthHeroAsset>> =
  {
    login: {
      webp: '/images/auth/login-hero.webp',
      jpg: '/images/auth/login-hero.jpg',
      alt: 'Secure login illustration with phone and shield',
    },
    signup: {
      webp: '/images/auth/signup-hero.webp',
      jpg: '/images/auth/signup-hero.jpg',
      alt: 'Welcome illustration with shield, tasks, and calendar',
    },
    forgot: {
      webp: '/images/auth/forgot-hero.webp',
      jpg: '/images/auth/forgot-hero.jpg',
      alt: 'Password recovery illustration with open lock and key',
    },
    'check-email': {
      webp: '/images/auth/check-email-hero.webp',
      jpg: '/images/auth/check-email-hero.jpg',
      alt: 'Check your email illustration with glowing envelope',
    },
    verify: {
      webp: '/images/auth/verify-hero.webp',
      jpg: '/images/auth/verify-hero.jpg',
      alt: 'Email verified illustration with envelope and shield',
    },
    'set-password': {
      webp: '/images/auth/set-password-hero.webp',
      jpg: '/images/auth/set-password-hero.jpg',
      alt: 'Set password illustration with keyhole and checkmark',
    },
  };
