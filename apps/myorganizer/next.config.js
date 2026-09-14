//@ts-check

/**
 * A plain Next.js config: the Nx Next.js plugin infers `build`, `dev`, and
 * `start` from this file, so nothing here depends on Nx (ADR 0083).
 *
 * @type {import('next').NextConfig}
 **/
const nextConfig = {
  // cPanel-friendly Node deployment.
  // Produces .next/standalone which can run with `node server.js`.
  // NOTE: Vercel's Next.js builder does not require (and can conflict with) standalone output.
  // Keep standalone for self-hosted/cPanel deployments, but disable it when building on Vercel.
  ...(process.env.VERCEL === '1' ? {} : { output: 'standalone' }),
  poweredByHeader: false,
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
      {
        // The standalone export/import route and the account-nested vault
        // settings route were consolidated into /dashboard/vault (PRD #478,
        // issue #482). Unlike the YouTube redirect above, a repo-wide sweep
        // found no email, notification, or backend reference to either old
        // path — this pair is bookmark insurance, not a hard requirement,
        // and is safe to drop once that risk feels stale.
        source: '/dashboard/vault-export',
        destination: '/dashboard/vault',
        permanent: true,
      },
      {
        source: '/dashboard/account/vault',
        destination: '/dashboard/vault',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
