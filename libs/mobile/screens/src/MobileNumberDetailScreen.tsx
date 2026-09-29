import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  putVaultRecord,
  type MobileNumberRecord,
  type UsageLocationRecord,
} from '@myorganizer/vault-core/portable';
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
  findVisibleMobileNumber,
  formatMobileNumber,
  isNotified,
  mobileNumberFields,
  readUsageLocations,
  type CopyableField,
  type DecryptedUsageLocation,
} from './contactModel';
import { DETAILS_ROUTES, type DetailsStackParamList } from './detailsStack';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { UsageLocationSection } from './UsageLocationSection';
import { describeVaultLoadError } from './vaultLoadError';

/**
 * One Mobile Number's detail: its fields with their own tap-to-copy, Copy
 * all and Share as the only thing that leaves the app, and this Mobile
 * Number's Usage Locations with notified-ticking. Creating or editing a
 * Mobile Number stays web-only for this slice.
 */
export function MobileNumberDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        DetailsStackParamList,
        typeof DETAILS_ROUTES.mobileNumberDetail
      >
    >();
  const { mobileNumberId } =
    useRoute<
      RouteProp<DetailsStackParamList, typeof DETAILS_ROUTES.mobileNumberDetail>
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
  } = useVaultBlob(VaultBlobType.MobileNumbers);

  const mobile = useMemo(
    () => findVisibleMobileNumber(snapshot?.envelope.records, mobileNumberId),
    [snapshot, mobileNumberId],
  );

  const { pendingId, revertedId, push, reloadAfterConflict, retryFailedEdit } =
    usePendingVaultEdit(apply, retry, reload);

  const { copy } = useSensitiveCopy();
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: mobile?.label ?? 'Mobile Number' });
  }, [navigation, mobile?.label]);

  const copyField = useCallback(
    (field: CopyableField): void => {
      void copy(field.value).then((message) => {
        if (message != null) setCopiedMessage(message);
      });
    },
    [copy],
  );

  const copyAll = useCallback((): void => {
    if (mobile === null) return;
    void copy(formatMobileNumber(mobile)).then((message) => {
      if (message != null) setCopiedMessage(message);
    });
  }, [mobile, copy]);

  const shareMobileNumber = useCallback((): void => {
    if (mobile === null) return;
    void Share.share({ message: formatMobileNumber(mobile) });
  }, [mobile]);

  const toggleNotified = useCallback(
    (location: DecryptedUsageLocation): void => {
      if (mobile === null) return;
      const now = new Date().toISOString();
      const nextChanged = !isNotified(location);
      const nextUsageLocations = readUsageLocations(mobile).map((entry) => {
        if (entry.id !== location.id) return entry;
        const updated = { ...entry, changed: nextChanged };
        if (nextChanged) {
          updated.changedAt = now;
        } else {
          delete updated.changedAt;
        }
        return updated;
      });
      void push(location.id, (envelope) =>
        putVaultRecord(envelope, {
          ...(mobile as MobileNumberRecord),
          usageLocations: nextUsageLocations as UsageLocationRecord[],
          updatedAt: now,
        }),
      );
    },
    [mobile, push],
  );

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
            message={describeVaultLoadError(loadError, 'this mobile number')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : mobile === null ? (
        <View style={styles.centered}>
          <EmptyState
            icon="details"
            title="Mobile Number not found"
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

          <ListSection title="Mobile Number" style={{ gap: theme.spacing.md }}>
            {mobileNumberFields(mobile).map((field) => (
              <ContactFieldRow
                key={field.id}
                field={field}
                onCopy={copyField}
              />
            ))}
            <Button label="Copy all" variant="secondary" onPress={copyAll} />
          </ListSection>

          <Button
            label="Share"
            variant="secondary"
            onPress={shareMobileNumber}
          />

          <UsageLocationSection
            usageLocations={readUsageLocations(mobile)}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
