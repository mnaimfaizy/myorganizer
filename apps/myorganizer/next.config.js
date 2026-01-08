//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

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
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
