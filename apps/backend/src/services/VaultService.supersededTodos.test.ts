import { describe, expect, jest, test } from '@jest/globals';
import { VaultService } from './VaultService';

describe('VaultService.deleteSupersededTodosBlobs', () => {
  test('runs SQL that deletes todos only when a tasks sibling exists', async () => {
    const executeRaw = jest.fn(async () => 3) as jest.MockedFunction<
      (...args: unknown[]) => Promise<number>
    >;
    const service = new VaultService({
      $executeRaw: executeRaw,
    } as never);

    const deleted = await service.deleteSupersededTodosBlobs();

    expect(deleted).toBe(3);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const sql = String(executeRaw.mock.calls[0]?.[0] ?? '');
    expect(sql).toContain("type = 'todos'");
    expect(sql).toContain("k.type = 'tasks'");
    expect(sql).toContain('EXISTS');
  });
});
