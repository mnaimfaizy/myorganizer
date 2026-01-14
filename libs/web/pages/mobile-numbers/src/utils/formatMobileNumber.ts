import { MobileNumberRecord } from '@myorganizer/core';
import { formatPhoneNumber } from '../data/countryCodes';

/**
 * Format a mobile number record for display
 */
export function formatMobileNumber(item: MobileNumberRecord): string {
  // If using structured fields
  if (item.countryCode && item.phoneNumber) {
    return formatPhoneNumber(item.countryCode, item.phoneNumber);
  }

  // Fallback to legacy single field
  return item.mobileNumber || 'No number provided';
}
