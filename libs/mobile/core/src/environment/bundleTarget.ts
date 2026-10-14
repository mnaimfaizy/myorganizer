// The bundle-time switch: which backend a debug build talks to.
//
// This file is the default, the development machine. Starting Metro with
// `MYORGANISER_MOBILE_BACKEND=production` makes apps/mobile/metro.config.js
// resolve every import of this module to bundleTarget.production.ts instead,
// which points a debug build at Production. It is fixed for the life of the
// bundle: no build has a runtime switcher. A release build ignores it and
// talks to Production either way (see resolveBackendTarget in environment.ts).
import type { BackendTarget } from './environment';

export const BUNDLE_TARGET: BackendTarget = 'local';
