import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Whether this device currently has no usable connection.
 *
 * Two questions, deliberately answered as one: a device can hold a Wi-Fi
 * association that routes nowhere, which `isConnected` alone reports as
 * online. `isInternetReachable` is `null` while the probe is still out, and
 * that is read as online — a banner that flashes on every cold start would
 * train the User to ignore it.
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setOffline(
        state.isConnected === false || state.isInternetReachable === false,
      );
    });
  }, []);

  return offline;
}
