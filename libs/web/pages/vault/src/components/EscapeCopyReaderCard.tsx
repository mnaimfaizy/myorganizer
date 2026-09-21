'use client';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@myorganizer/web-ui';

import {
  ESCAPE_COPY_READER_CHECKSUM_FILENAME,
  ESCAPE_COPY_READER_FILENAME,
  ESCAPE_COPY_READER_RELEASES_URL,
} from '../constants';

interface EscapeCopyReaderCardProps {
  /**
   * Whether an Escape Copy has been made while this page has been open —
   * a local Export, a Drive backup the User asked for, or a scheduled Drive
   * backup that ran unattended. All three raise the same callout, because
   * ADR 0064 asks for the prompt on *every* copy and the unattended one is
   * the copy the User is least likely to know about.
   *
   * That is why the wording says a copy was made rather than that the User
   * made one: the scheduler makes copies with nobody present, and telling
   * somebody they just did something they did not is how a prompt starts
   * getting ignored.
   *
   * Sticky for the life of the page, deliberately. The User this is for is
   * the one who leaves to go and find the downloaded file; taking the
   * reminder away while they are gone serves nobody.
   */
  justMadeACopy?: boolean;
}

export function EscapeCopyReaderCard({
  justMadeACopy,
}: EscapeCopyReaderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open your Escape Copy without us</CardTitle>
        <CardDescription>
          A self-contained reader that works offline and needs no account
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {justMadeACopy && (
          <div
            className="rounded-lg border border-warning bg-warning/10 p-4"
            data-testid="escape-copy-reader-just-made"
          >
            <p className="text-sm font-medium text-warning">
              An Escape Copy was just made. Get the reader and keep it with your
              copy — a copy you cannot open is not a backup.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            The Escape Copy reader is one self-contained HTML file. It requires
            no account, no server, and no Google account. It works completely
            offline, displays your data on screen only, and never writes
            decrypted files to disk.
          </p>

          <p>
            Download{' '}
            <code className="bg-muted rounded px-1 py-0.5 text-xs">
              {ESCAPE_COPY_READER_FILENAME}
            </code>{' '}
            from the GitHub Releases page and keep it in the same folder as your
            Escape Copy. When you need to read your copy, open the reader,
            select your Escape Copy file, and enter either your passphrase or
            your recovery key — both open it. Your data appears on screen.
          </p>

          <p className="font-medium text-foreground">
            Verify the file before opening it with your passphrase. A file that
            accepts a vault passphrase is exactly what an attacker would want to
            substitute.
          </p>

          <p>
            After downloading, verify the reader's integrity against the
            published{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              {ESCAPE_COPY_READER_CHECKSUM_FILENAME}
            </code>{' '}
            file using:
          </p>

          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>
              <code className="bg-muted px-1 py-0.5 rounded">sha256sum</code>{' '}
              (Linux/macOS/WSL)
            </li>
            <li>
              <code className="bg-muted px-1 py-0.5 rounded">
                shasum -a 256
              </code>{' '}
              (macOS legacy)
            </li>
            <li>
              <code className="bg-muted px-1 py-0.5 rounded">Get-FileHash</code>{' '}
              (Windows PowerShell)
            </li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button asChild>
            <a
              href={ESCAPE_COPY_READER_RELEASES_URL}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="escape-copy-reader-download-link"
            >
              Get the reader from GitHub Releases
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
