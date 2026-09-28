import type { Appearance } from '@myorganizer/mobile/core';
import type { ColorMode } from './theme';

/**
 * Which colour mode to render, given what the User chose and what the OS
 * reports. This is the whole of `system` mode: the setting says *follow*, and
 * the answer is whatever the device says at the moment it is asked.
 *
 * React Native's `useColorScheme` can return `null` — no preference yet, which
 * happens on Android before the first configuration read — and light is the
 * answer then, the same answer the OS itself defaults to.
 */
export function resolveColorMode(
  appearance: Appearance,
  systemScheme: ColorMode | null | undefined,
): ColorMode {
  if (appearance !== 'system') return appearance;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
