const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    // Specs must stub APIs through `routeApi`, never `page.route` directly.
    //
    // Stub patterns here are deliberately origin-agnostic (`/\/vault\/?$/`,
    // `/\/admin\/users\/?$/`) so they match the backend wherever it is served
    // from — which also makes them match the app's own routes. A raw
    // `page.route` then fulfils the *document* request for
    // `/dashboard/vault` or `/admin/users` with the API's JSON body, so the
    // page under test never renders and every selector on it times out. That
    // silently broke six specs (issue #506). `routeApi` hands document
    // requests back to Next.js.
    //
    // Non-API interception (scripts, images, fonts) is a legitimate exception:
    // disable this rule on the line with a comment saying what it intercepts.
    files: ['**/src/e2e/**/*.ts'],
    ignores: ['**/src/e2e/helpers/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name="route"]',
          message:
            'Use routeApi(page, url, handler) from ./helpers instead of page.route(). Origin-agnostic stub patterns also match the app’s own routes, so a raw page.route() fulfils document navigations with API JSON and the page never renders (issue #506). For non-API interception, disable this rule on the line and say what it intercepts.',
        },
      ],
    },
  },
];
