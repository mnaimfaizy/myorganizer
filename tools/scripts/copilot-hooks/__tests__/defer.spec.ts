import {
  PRE_TOOL_USE_HOOK,
  SECRET_SCAN_HOOK,
  runHookRaw,
  expectDenied,
  shellPayload,
} from './hook-harness';

const ENV_FILE = '.env';

describe('--defer flag behavior', () => {
  describe('pre-tool-use hook with --defer', () => {
    it('should exit 0 with empty stdout on benign command', () => {
      const result = runHookRaw(PRE_TOOL_USE_HOOK, shellPayload('Bash', 'ls'), {
        args: ['--defer'],
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });

    it('should still deny a Write to a protected file', () => {
      expectDenied(
        PRE_TOOL_USE_HOOK,
        {
          tool_name: 'Write',
          tool_input: { file_path: ENV_FILE, content: 'x' },
        },
        /environment/i,
        { args: ['--defer'] },
      );
    });

    it('should exit 0 with explicit allow JSON without --defer', () => {
      const result = runHookRaw(PRE_TOOL_USE_HOOK, shellPayload('Bash', 'ls'));

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('permissionDecision');
      expect(result.stdout).toContain('allow');
    });
  });

  describe('secret-scan hook with --defer', () => {
    it('should exit 0 with empty stdout on benign command', () => {
      const result = runHookRaw(
        SECRET_SCAN_HOOK,
        shellPayload('Bash', 'echo hello world'),
        { args: ['--defer'] },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
    });
  });
});
