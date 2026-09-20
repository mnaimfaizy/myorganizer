import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

jest.mock('../services/VaultService', () => ({
  __esModule: true,
  default: {
    deleteSupersededTodosBlobs: jest.fn(),
  },
}));

const vaultService = require('../services/VaultService').default as {
  deleteSupersededTodosBlobs: jest.MockedFunction<() => Promise<number>>;
};
const { deleteSupersededTodosBlobsOnBoot } =
  require('./deleteSupersededTodosBlobs') as {
    deleteSupersededTodosBlobsOnBoot: () => Promise<void>;
  };

const deleteMock = vaultService.deleteSupersededTodosBlobs;

describe('deleteSupersededTodosBlobsOnBoot', () => {
  let logSpy: jest.SpiedFunction<typeof console.log>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('is silent when no superseded rows are deleted', async () => {
    deleteMock.mockResolvedValueOnce(0);

    await deleteSupersededTodosBlobsOnBoot();

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('logs when superseded rows are deleted', async () => {
    deleteMock.mockResolvedValueOnce(2);

    await deleteSupersededTodosBlobsOnBoot();

    expect(logSpy).toHaveBeenCalledWith(
      '[bootstrap] Deleted 2 superseded todos vault blob(s).',
    );
  });

  test('swallows errors so boot cannot fail the process', async () => {
    deleteMock.mockRejectedValueOnce(new Error('db down'));

    await expect(deleteSupersededTodosBlobsOnBoot()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
