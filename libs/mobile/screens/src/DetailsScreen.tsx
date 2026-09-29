import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import { useVaultBlob } from '@myorganizer/mobile/feat-vault';
import {
  Button,
  EmptyState,
  InlineNotice,
  ListRow,
  ListSection,
  OfflineBanner,
  Screen,
  SegmentedControl,
  useTheme,
} from '@myorganizer/mobile/ui';
import {
  describeToNotify,
  formatAddressLine,
  formatMobileNumber,
  readUsageLocations,
  readVisibleMobileNumbers,
  splitAddressesByStatus,
  type DecryptedAddress,
  type DecryptedMobileNumber,
} from './contactModel';
import { DETAILS_ROUTES, type DetailsStackParamList } from './detailsStack';
import { TAB_SCREEN_EDGES, TabScreenHeader } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';
import { useRememberedScroll } from './useRememberedScroll';

type DetailsSegment = 'addresses' | 'mobileNumbers';

const SEGMENTS = [
  { value: 'addresses', label: 'Addresses' },
  { value: 'mobileNumbers', label: 'Mobile Numbers' },
] as const satisfies readonly { value: DetailsSegment; label: string }[];

/**
 * Which Vault Blob Type each Details segment reads, pinned against the whole
 * enum so a sixth Vault Blob Type fails to compile here rather than silently
 * being left out of this screen (ADR 0053) — the shape that let a hand-rolled
 * fan-out destroy grocery Ciphertext in #512 and drop the Tasks blob from
 * hardened export in #537. The Details tab has no use for the other three
 * types, so they are pinned to `null` rather than omitted.
 */
const DETAILS_VAULT_BLOB_TYPE = {
  addresses: VaultBlobType.Addresses,
  groceries: null,
  mobileNumbers: VaultBlobType.MobileNumbers,
  subscriptions: null,
  tasks: null,
} as const satisfies Record<VaultBlobType, VaultBlobType | null>;

/** The amber dot a row shows beside its name when it has at least one
 * unnotified Usage Location. Purely decorative: the row's own accessibility
 * label already carries "n to notify" through its subtitle. */
function UnnotifiedDot(): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.dot,
        {
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.warning,
        },
      ]}
    />
  );
}

/**
 * The Details tab: Addresses and Mobile Numbers, read-first. Addresses shows
 * current ones first and old ones in a collapsed section; Mobile Numbers has
 * no such split. A row with an unnotified Usage Location carries the amber
 * dot and its "n to notify" count; tapping any row opens that record's
 * detail, where tap-to-copy, Copy all, Open in Maps / Share, and Usage
 * Location ticking live.
 */
export function DetailsScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<DetailsStackParamList>>();
  const rememberedScroll = useRememberedScroll('Details');
  const [segment, setSegment] = useState<DetailsSegment>('addresses');

  const addressesBlob = useVaultBlob(DETAILS_VAULT_BLOB_TYPE.addresses);
  const mobileNumbersBlob = useVaultBlob(DETAILS_VAULT_BLOB_TYPE.mobileNumbers);

  const { current, old } = useMemo(
    () => splitAddressesByStatus(addressesBlob.snapshot?.envelope.records),
    [addressesBlob.snapshot],
  );
  const mobileNumbers = useMemo(
    () =>
      readVisibleMobileNumbers(mobileNumbersBlob.snapshot?.envelope.records),
    [mobileNumbersBlob.snapshot],
  );

  const openAddress = useCallback(
    (addressId: string): void => {
      navigation.navigate(DETAILS_ROUTES.addressDetail, { addressId });
    },
    [navigation],
  );

  const openMobileNumber = useCallback(
    (mobileNumberId: string): void => {
      navigation.navigate(DETAILS_ROUTES.mobileNumberDetail, {
        mobileNumberId,
      });
    },
    [navigation],
  );

  const renderAddressRow = (address: DecryptedAddress): React.JSX.Element => {
    const usageLocations = readUsageLocations(address);
    const toNotify = describeToNotify(usageLocations);
    const summary = formatAddressLine(address);
    const title = address.label ?? (summary.length > 0 ? summary : 'Address');

    return (
      <ListRow
        key={address.id}
        title={title}
        subtitle={toNotify}
        leading={toNotify != null ? <UnnotifiedDot /> : undefined}
        onPress={() => openAddress(address.id)}
        style={[styles.row, { borderRadius: theme.radii.md }]}
      />
    );
  };

  const renderMobileNumberRow = (
    mobile: DecryptedMobileNumber,
  ): React.JSX.Element => {
    const usageLocations = readUsageLocations(mobile);
    const toNotify = describeToNotify(usageLocations);
    const summary = formatMobileNumber(mobile);
    const title =
      mobile.label ?? (summary.length > 0 ? summary : 'Mobile Number');

    return (
      <ListRow
        key={mobile.id}
        title={title}
        subtitle={toNotify}
        leading={toNotify != null ? <UnnotifiedDot /> : undefined}
        onPress={() => openMobileNumber(mobile.id)}
        style={[styles.row, { borderRadius: theme.radii.md }]}
      />
    );
  };

  const activeBlob =
    segment === 'addresses' ? addressesBlob : mobileNumbersBlob;
  const nothingToShow =
    segment === 'addresses'
      ? current.length === 0 && old.length === 0
      : mobileNumbers.length === 0;

  return (
    <Screen edges={TAB_SCREEN_EDGES}>
      <TabScreenHeader title="Details" />

      {activeBlob.loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : activeBlob.loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
          <OfflineBanner />
          <InlineNotice
            tone="destructive"
            message={describeVaultLoadError(
              activeBlob.loadError,
              segment === 'addresses'
                ? 'your addresses'
                : 'your mobile numbers',
            )}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void activeBlob.reload()}
          />
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.content,
            {
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              paddingBottom: theme.spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          {...rememberedScroll}
        >
          <OfflineBanner />

          <SegmentedControl
            segments={SEGMENTS}
            value={segment}
            onChange={setSegment}
            accessibilityLabel="Addresses or Mobile Numbers"
          />

          {nothingToShow && (
            <EmptyState
              icon="details"
              title={
                segment === 'addresses'
                  ? 'No addresses yet'
                  : 'No mobile numbers yet'
              }
              description="Add one on the web."
            />
          )}

          {segment === 'addresses' ? (
            <>
              {current.length > 0 && (
                <ListSection
                  title="Current"
                  meta={`${current.length}`}
                  style={{ gap: theme.spacing.sm }}
                >
                  {current.map(renderAddressRow)}
                </ListSection>
              )}
              {old.length > 0 && (
                <ListSection
                  title="Old"
                  meta={`${old.length}`}
                  collapsible
                  defaultCollapsed
                  style={{ gap: theme.spacing.sm }}
                >
                  {old.map(renderAddressRow)}
                </ListSection>
              )}
            </>
          ) : (
            mobileNumbers.length > 0 && (
              <ListSection
                title="Mobile Numbers"
                meta={`${mobileNumbers.length}`}
                style={{ gap: theme.spacing.sm }}
              >
                {mobileNumbers.map(renderMobileNumberRow)}
              </ListSection>
            )
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  row: {
    overflow: 'hidden',
  },
  dot: {
    width: 8,
    height: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
