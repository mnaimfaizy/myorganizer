import { AddressRecord } from '@myorganizer/core';

/**
 * Check if an address record uses the new structured format
 */
export function isStructuredAddress(item: AddressRecord): boolean {
  return !!(item.street || item.suburb || item.country);
}

/**
 * Get a Google Maps search URL for an address
 */
export function getGoogleMapsUrl(item: AddressRecord): string {
  if (isStructuredAddress(item)) {
    const parts: string[] = [];

    // Property Number + Street
    const line1 = [item.propertyNumber, item.street].filter(Boolean).join(' ');
    if (line1) parts.push(line1);

    // Suburb + State
    const line2 = [item.suburb, item.state].filter(Boolean).join(' ');
    if (line2) parts.push(line2);

    // Zip Code + Country
    const line3 = [item.zipCode, item.country].filter(Boolean).join(' ');
    if (line3) parts.push(line3);

    const address = parts.join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address
    )}`;
  }

  const address = item.address || '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address
  )}`;
}

/**
 * Format address for display in forms (multi-line)
 */
export function formatAddressMultiline(item: AddressRecord): string[] {
  if (isStructuredAddress(item)) {
    const lines: string[] = [];

    // Line 1: Property number + Street
    const line1 = [item.propertyNumber, item.street].filter(Boolean).join(' ');
    if (line1) lines.push(line1);

    // Line 2: Suburb + State (with comma if both present)
    const suburbState = [];
    if (item.suburb) suburbState.push(item.suburb);
    if (item.state) suburbState.push(item.state);
    if (suburbState.length > 0) {
      lines.push(suburbState.join(', '));
    }

    // Line 3: Zip Code + Country (with comma if both present)
    const zipCountry = [];
    if (item.zipCode) zipCountry.push(item.zipCode);
    if (item.country) zipCountry.push(item.country);
    if (zipCountry.length > 0) {
      lines.push(zipCountry.join(', '));
    }

    return lines;
  }

  return item.address ? [item.address] : ['No address provided'];
}
