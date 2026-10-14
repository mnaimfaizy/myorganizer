import React, { useEffect, useState } from 'react';
import {
  MOBILE_ENVIRONMENT,
  backendOriginStore,
  getDeviceSettings,
  guardBackendOrigin,
  isBackendOriginUnchanged,
} from '@myorganizer/mobile/core';
import { clearUserLocalData } from './userLocalData';

/**
 * Holds the app back until its local data is known to belong to the backend
 * this bundle talks to (the data guard, PRD #956).
 *
 * It sits above `AuthProvider` because that provider's first effect sends the
 * Refresh Token to the backend: a token from another origin must be gone
 * before it mounts. An unchanged origin is decided synchronously from MMKV,
 * so the usual launch renders its first frame without waiting.
 *
 * A clear that fails still lets the app start: the record is left as it was,
 * so the next launch tries again, and a Refresh Token another backend never
 * issued is refused and dropped by the ordinary refresh path.
 */
export function BackendOriginGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element | null {
  const [ready, setReady] = useState(() =>
    isBackendOriginUnchanged(
      backendOriginStore.read(),
      MOBILE_ENVIRONMENT.apiOrigin,
    ),
  );

  useEffect(() => {
    if (ready) return;
    let mounted = true;
    guardBackendOrigin({
      currentOrigin: MOBILE_ENVIRONMENT.apiOrigin,
      store: backendOriginStore,
      clearUserLocalData,
      // Users this installation knew before the record existed.
      additionalUserIds: getDeviceSettings().biometricOfferedUserIds,
    })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [ready]);

  return ready ? <>{children}</> : null;
}
