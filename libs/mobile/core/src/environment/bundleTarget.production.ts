// Bundled in place of bundleTarget.ts when Metro starts with
// `MYORGANISER_MOBILE_BACKEND=production` (apps/mobile/metro.config.js).
// Nothing imports this file by name.
import type { BackendTarget } from './environment';

export const BUNDLE_TARGET: BackendTarget = 'production';
