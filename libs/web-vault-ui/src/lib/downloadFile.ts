/**
 * Downloads a file to the user's device with the specified content and MIME type.
 */
function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads a plain text file to the user's device.
 */
export function downloadTextFile(filename: string, content: string): void {
  downloadFile(filename, content, 'text/plain');
}

/**
 * Downloads a JSON file to the user's device.
 */
export function downloadJsonFile(filename: string, content: string): void {
  downloadFile(filename, content, 'application/json');
}
