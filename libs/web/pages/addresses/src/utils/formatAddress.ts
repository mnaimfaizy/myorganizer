import { AddressRecord } from '@myorganizer/core';

/**
 * Format a structured address into a single-line string
 */
export function formatAddress(item: AddressRecord): string {
  // If using structured fields
  if (item.street || item.suburb || item.country) {
    const parts: string[] = [];

    // Group 1: Property Number + Street
    const line1 = [item.propertyNumber, item.street].filter(Boolean).join(' ');
    if (line1) parts.push(line1);

    // Group 2: Suburb + State (no comma between)
    const line2 = [item.suburb, item.state].filter(Boolean).join(' ');
    if (line2) parts.push(line2);

    // Group 3: Zip Code + Country (no comma between)
    const line3 = [item.zipCode, item.country].filter(Boolean).join(' ');
    if (line3) parts.push(line3);

    return parts.join(', ');
  }

  // Fallback to legacy address field
  return item.address || 'No address provided';
}
