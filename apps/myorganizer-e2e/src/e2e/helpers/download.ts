import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Download } from '@playwright/test';

/**
 * Save a Playwright download to a unique temp file and return its UTF-8 text.
 *
 * `Download.path()` is unavailable when the test connects to a remote browser
 * (issue #796). The export specs started using `path()` in #77. `saveAs`
 * writes a local copy either way. `randomUUID()` keeps parallel workers from
 * sharing one tmp path.
 */
export async function readDownloadText(download: Download): Promise<string> {
  const downloadPath = join(tmpdir(), `vault-export-${randomUUID()}.json`);
  await download.saveAs(downloadPath);
  return readFile(downloadPath, 'utf8');
}
