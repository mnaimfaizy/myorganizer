import {
  SECRET_SCAN_HOOK,
  expectAllowed,
  expectDenied,
  shellPayload,
} from './hook-harness';

/**
 * Every credential-shaped fixture is assembled from fragments at runtime. A
 * literal one would trip this very hook when the file is written, and would
 * also trip repository and CI secret scanning.
 */
const AWS_ACCESS_KEY = ['AKIA', 'IOSFODNN7', 'EXAMPLE'].join('');
const GITHUB_TOKEN = ['ghp', '_', 'a'.repeat(36)].join('');
const PRIVATE_KEY_MARKER = ['-----BEGIN ', 'RSA PRIVATE KEY', '-----'].join('');

describe('secret-scan hook', () => {
  describe('credential detection', () => {
    it('should deny a command containing an AWS access key', () => {
      expectDenied(
        SECRET_SCAN_HOOK,
        shellPayload('Bash', `echo ${AWS_ACCESS_KEY}`),
        /secret|credential/i,
      );
    });

    it('should deny a command containing a GitHub token', () => {
      expectDenied(
        SECRET_SCAN_HOOK,
        shellPayload('Bash', `echo ${GITHUB_TOKEN}`),
        /github|secret|token/i,
      );
    });

    it('should deny a command containing a private key marker', () => {
      expectDenied(
        SECRET_SCAN_HOOK,
        shellPayload('Bash', `echo "${PRIVATE_KEY_MARKER}"`),
        /private key/i,
      );
    });

    it('should deny credential material passed through a Write tool call', () => {
      expectDenied(
        SECRET_SCAN_HOOK,
        {
          tool_name: 'Write',
          tool_input: {
            file_path: 'src/config.ts',
            content: `export const key = '${AWS_ACCESS_KEY}';`,
          },
        },
        /secret|credential/i,
      );
    });
  });

  describe('benign input', () => {
    it('should allow a plain echo', () => {
      expectAllowed(SECRET_SCAN_HOOK, shellPayload('Bash', 'echo hello world'));
    });

    it('should allow a Write tool call with ordinary source content', () => {
      expectAllowed(SECRET_SCAN_HOOK, {
        tool_name: 'Write',
        tool_input: {
          file_path: 'src/app/page.tsx',
          content: 'export default function Page() { return null; }',
        },
      });
    });
  });
});
