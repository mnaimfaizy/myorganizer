/**
 * Runs a boot-time side effect without letting failures take down the process.
 * Callers own success/skip logging inside `task`.
 */
export async function runBootTask(
  failureMessage: string,
  task: () => Promise<void>,
): Promise<void> {
  try {
    await task();
  } catch (err) {
    console.error(failureMessage, err);
  }
}
