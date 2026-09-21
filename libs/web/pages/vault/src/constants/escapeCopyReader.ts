/**
 * URL to the GitHub Releases page where the Escape Copy reader HTML file
 * is published. This is the authoritative source where users should download
 * the latest reader version.
 */
export const ESCAPE_COPY_READER_RELEASES_URL =
  'https://github.com/mnaimfaizy/myorganizer/releases/latest';

/**
 * Filename of the self-contained HTML reader that decrypts and displays
 * Escape Copy vaults offline. Users download this from GitHub Releases
 * and keep it in the same folder as their Escape Copy backup.
 */
export const ESCAPE_COPY_READER_FILENAME =
  'myorganizer-escape-copy-reader.html';

/**
 * Filename of the checksums file published alongside the reader on GitHub Releases.
 * Users verify the reader's integrity against this file before opening it with
 * their vault passphrase (SHA256 verification prevents attacker substitution).
 */
export const ESCAPE_COPY_READER_CHECKSUM_FILENAME = 'SHA256SUMS.txt';
