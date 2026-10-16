import React, { useEffect, useState } from 'react';
import {
  MOBILE_ENVIRONMENT,
  backendOriginStore,
  getDeviceSettings,
  guardBackendOrigin,
  isBackendOriginUnchanged,
} from '@myorganiser/mobile/core';
import { clearUserLocalData } from './userLocalData';

/**
 * How the launch's data guard ended. `failed` means a User's local data from
 * another backend origin may still be on the device.
 */
export type BackendOriginGateState = 'ready' | 'failed';

/**
 * Holds the app back until its local data is known to belong to the backend
 * this bundle talks to (the data guard, PRD #956), then renders
 * `children(state)`.
 *
 * It sits above `AuthProvider` because that provider's first effect sends the
 * Refresh Token to the backend: a token from another origin must be gone
 * before it mounts. An unchanged origin is decided synchronously from MMKV,
 * so the usual launch renders its first frame without waiting.
 *
 * A clear that fails renders `failed` rather than holding the app on a blank
 * screen: the caller then starts signed out without restoring, so a Refresh
 * Token the clear could not remove is never sent anywhere. The record is left
 * as it was, so the next launch tries the clear again.
 */
export function BackendOriginGate({
  children,
}: {
  children: (state: BackendOriginGateState) => React.ReactNode;
}): React.JSX.Element | null {
  const [state, setState] = useState<BackendOriginGateState | 'guarding'>(() =>
    isBackendOriginUnchanged(
      backendOriginStore.read(),
      MOBILE_ENVIRONMENT.apiOrigin,
    )
      ? 'ready'
      : 'guarding',
  );

  useEffect(() => {
    if (state !== 'guarding') return;
    let mounted = true;
    guardBackendOrigin({
      currentOrigin: MOBILE_ENVIRONMENT.apiOrigin,
      store: backendOriginStore,
      clearUserLocalData,
      // Users this installation knew before the record existed.
      additionalUserIds: getDeviceSettings().biometricOfferedUserIds,
    }).then(
      () => {
        if (mounted) setState('ready');
      },
      () => {
        if (mounted) setState('failed');
      },
    );
    return () => {
      mounted = false;
    };
  }, [state]);

  return state === 'guarding' ? null : <>{children(state)}</>;
}
