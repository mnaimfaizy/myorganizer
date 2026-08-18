//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

// Ensure consistent production builds regardless of the caller's environment.
// Next.js warns (and can behave inconsistently) when NODE_ENV is unset or non-standard.
// Nx sets NX_TASK_TARGET_TARGET for task runs; only force this for the build target.
if (process.env.NX_TASK_TARGET_TARGET === 'build') {
  /** @type {any} */ (process.env).NODE_ENV = 'production';
}

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // cPanel-friendly Node deployment.
  // Produces .next/standalone which can run with `node server.js`.
  // NOTE: Vercel's Next.js builder does not require (and can conflict with) standalone output.
  // Keep standalone for self-hosted/cPanel deployments, but disable it when building on Vercel.
  ...(process.env.VERCEL === '1' ? {} : { output: 'standalone' }),
  poweredByHeader: false,
  nx: {},
  async redirects() {
    return [
      {
        // The per-channel grid was replaced by the channel directory on
        // /dashboard/youtube, which is the locked long-form home (PRD #264,
        // Variant C / issue #250). Digest emails already sitting in Users'
        // inboxes point at the old path, so it is redirected, not removed.
        source: '/dashboard/youtube/channel/:channelId',
        destination: '/dashboard/youtube?channel=:channelId',
        permanent: true,
      },
    ];
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
