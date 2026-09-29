import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  usePendingVaultEdit,
  useSensitiveCopy,
  useVaultBlob,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import {
  Button,
  EmptyState,
  InlineNotice,
  ListSection,
  OfflineBanner,
  Screen,
  Snackbar,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import { ContactFieldRow } from './ContactFieldRow';
import {
  addressFields,
  findVisibleAddress,
  formatAddressLine,
  mapsUrlForAddress,
  readUsageLocations,
  type CopyableField,
} from './contactModel';
import { DETAILS_ROUTES, type DetailsStackParamList } from './detailsStack';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { UsageLocationSection } from './UsageLocationSection';
import { useUsageLocationToggle } from './useUsageLocationToggle';
import { describeVaultLoadError } from './vaultLoadError';

/**
 * One Address's detail: every field with its own tap-to-copy, Copy all, Open
 * in Maps and Share as the only two things that leave the app, and this
 * Address's Usage Locations with notified-ticking. Creating or editing an
 * Address stays web-only for this slice.
 */
export function AddressDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        DetailsStackParamList,
        typeof DETAILS_ROUTES.addressDetail
      >
    >();
  const { addressId } =
    useRoute<
      RouteProp<DetailsStackParamList, typeof DETAILS_ROUTES.addressDetail>
    >().params;

  const {
    snapshot,
    loading,
    loadError,
    writing,
    writeError,
    reload,
    apply,
    retry,
  } = useVaultBlob(VaultBlobType.Addresses);

  const address = useMemo(
    () => findVisibleAddress(snapshot?.envelope.records, addressId),
    [snapshot, addressId],
  );

  const { pendingId, revertedId, push, reloadAfterConflict, retryFailedEdit } =
    usePendingVaultEdit(apply, retry, reload);

  const { copy } = useSensitiveCopy();
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: address?.label ?? 'Address' });
  }, [navigation, address?.label]);

  const copyField = useCallback(
    (field: CopyableField): void => {
      void copy(field.value).then((message) => {
        if (message != null) setCopiedMessage(message);
      });
    },
    [copy],
  );

  const copyAll = useCallback((): void => {
    if (address === null) return;
    void copy(formatAddressLine(address)).then((message) => {
      if (message != null) setCopiedMessage(message);
    });
  }, [address, copy]);

  const openInMaps = useCallback((): void => {
    if (address === null) return;
    void Linking.openURL(
      mapsUrlForAddress(address, Platform.OS === 'ios' ? 'ios' : 'android'),
    );
  }, [address]);

  const shareAddress = useCallback((): void => {
    if (address === null) return;
    void Share.share({ message: formatAddressLine(address) });
  }, [address]);

  const toggleNotified = useUsageLocationToggle(address, push);

  const rowState = (id: string): ListRowState =>
    pendingId === id
      ? 'unconfirmed'
      : revertedId === id && writeError != null
        ? 'reverted'
        : 'normal';

  const notice = writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];

  return (
    <Screen edges={STACK_SCREEN_EDGES}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
          <OfflineBanner />
          <InlineNotice
            tone="destructive"
            message={describeVaultLoadError(loadError, 'this address')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : address === null ? (
        <View style={styles.centered}>
          <EmptyState
            icon="details"
            title="Address not found"
            description="It may have been deleted on another device."
          />
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.content,
            { gap: theme.spacing.lg, padding: theme.spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <OfflineBanner />

          {revertedId != null && notice != null && (
            <InlineNotice
              tone="destructive"
              message={notice.message}
              actionLabel={notice.action}
              onAction={() =>
                void (writeError === 'conflict'
                  ? reloadAfterConflict()
                  : retryFailedEdit())
              }
            />
          )}

          <ListSection title="Address" style={{ gap: theme.spacing.md }}>
            {addressFields(address).map((field) => (
              <ContactFieldRow
                key={field.id}
                field={field}
                onCopy={copyField}
              />
            ))}
            <Button label="Copy all" variant="secondary" onPress={copyAll} />
          </ListSection>

          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            <Button
              label="Open in Maps"
              variant="secondary"
              onPress={openInMaps}
            />
            <Button label="Share" variant="secondary" onPress={shareAddress} />
          </View>

          <UsageLocationSection
            usageLocations={readUsageLocations(address)}
            writing={writing}
            rowState={rowState}
            writeError={writeError}
            onToggleNotified={toggleNotified}
            onRetry={() =>
              void (writeError === 'conflict'
                ? reloadAfterConflict()
                : retryFailedEdit())
            }
            retryLabel={notice?.action ?? 'Retry'}
            revertedReason={notice?.message}
          />
        </ScrollView>
      )}

      <Snackbar
        visible={copiedMessage !== null}
        message={copiedMessage ?? ''}
        onDismiss={() => setCopiedMessage(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
