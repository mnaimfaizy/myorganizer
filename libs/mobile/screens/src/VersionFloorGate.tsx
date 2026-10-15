import React, { useCallback } from 'react';
import { Linking } from 'react-native';
import { MOBILE_RELEASE_DOWNLOAD_URL } from '@myorganiser/mobile/core';
import { useVersionFloorRefusal } from '@myorganiser/mobile/feat-auth';
import { UpdateRequiredScreen } from './UpdateRequiredScreen';

/**
 * Shows Update required in place of the whole app once the backend has
 * refused this build, signed in or not, locked or not. Until then it renders
 * `children` untouched.
 */
export function VersionFloorGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const refusal = useVersionFloorRefusal();
  const openDownload = useCallback(() => {
    void Linking.openURL(MOBILE_RELEASE_DOWNLOAD_URL);
  }, []);

  if (refusal === null) return <>{children}</>;
  return (
    <UpdateRequiredScreen
      unsavedChange={refusal.unsavedChange}
      onDownload={openDownload}
    />
  );
}
