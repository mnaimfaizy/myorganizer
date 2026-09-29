import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import { webAppPath } from '@myorganizer/mobile/feat-auth';
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
  Text,
  useLargeTitleCollapse,
  useTheme,
  type IconName,
} from '@myorganizer/mobile/ui';
import {
  countUnnotified,
  formatAddressSummary,
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
 * What each segment says and draws, pinned to the segment set: the glyph its
 * rows and empty state carry, its empty state's title, the web page that
 * adds one, and the noun a failed load names.
 */
const SEGMENT_COPY = {
  addresses: {
    icon: 'home',
    emptyTitle: 'No Addresses yet',
    webPath: '/dashboard/addresses',
    loadSubject: 'your addresses',
  },
  mobileNumbers: {
    icon: 'phone',
    emptyTitle: 'No Mobile Numbers yet',
    webPath: '/dashboard/mobile-numbers',
    loadSubject: 'your mobile numbers',
  },
} as const satisfies Record<
  DetailsSegment,
  { icon: IconName; emptyTitle: string; webPath: string; loadSubject: string }
>;

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

/**
 * The trailing "● 3 to notify" on a row with someone still to tell: an amber
 * dot and the count. The dot is decorative — the row's accessibility label
 * already carries the count.
 */
function ToNotify({ count }: { count: number }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={[styles.inline, { gap: theme.spacing.xs }]}>
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
      <Text variant="caption" weight="semibold" color="foreground">
        {`${count} to notify`}
      </Text>
    </View>
  );
}

/** One Address or Mobile Number in the list: its tile, its name, the line it
 * is recognised by, who is still to be told, and the way into its detail. */
function ContactRow({
  icon,
  title,
  summary,
  numeric,
  toNotify,
  onPress,
}: {
  icon: IconName;
  title: string;
  summary: string;
  numeric: boolean;
  toNotify: number;
  onPress: () => void;
}): React.JSX.Element {
  const toNotifyText = toNotify > 0 ? `${toNotify} to notify` : null;
  return (
    <ListRow
      title={title}
      titleWeight="semibold"
      size="tall"
      subtitle={summary.length > 0 ? summary : undefined}
      subtitleContent={
        summary.length > 0 ? (
          // The sheet sets the summary at 15/20 — `bodySm`, not the row's
          // default caption line.
          <Text
            variant="bodySm"
            color="mutedForeground"
            numberOfLines={1}
            style={numeric ? styles.figures : undefined}
          >
            {summary}
          </Text>
        ) : undefined
      }
      leadingIcon={icon}
      leadingIconSize="large"
      trailing={toNotify > 0 ? <ToNotify count={toNotify} /> : undefined}
      chevron
      onPress={onPress}
      accessibilityLabel={[title, summary, toNotifyText]
        .filter((part): part is string => part != null && part.length > 0)
        .join(', ')}
    />
  );
}

/**
 * The Details tab (Det-List): Addresses and Mobile Numbers, read-first.
 * Addresses shows current ones first and old ones in a collapsed section;
 * Mobile Numbers has no such split. A row with an unnotified Usage Location
 * carries the amber dot and its "n to notify" count; tapping any row opens
 * that record's detail. Details are added and edited on the web, which the
 * screen says at its foot and its empty state links to.
 */
export function DetailsScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<DetailsStackParamList>>();
  const rememberedScroll = useRememberedScroll('Details');
  const titleCollapse = useLargeTitleCollapse();
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
    const summary = formatAddressSummary(address);
    return (
      <ContactRow
        key={address.id}
        icon={SEGMENT_COPY.addresses.icon}
        title={address.label?.trim() || summary || 'Address'}
        summary={summary}
        numeric={false}
        toNotify={countUnnotified(readUsageLocations(address))}
        onPress={() => openAddress(address.id)}
      />
    );
  };

  const renderMobileNumberRow = (
    mobile: DecryptedMobileNumber,
  ): React.JSX.Element => {
    const summary = formatMobileNumber(mobile);
    return (
      <ContactRow
        key={mobile.id}
        icon={SEGMENT_COPY.mobileNumbers.icon}
        title={mobile.label?.trim() || summary || 'Mobile Number'}
        summary={summary}
        numeric
        toNotify={countUnnotified(readUsageLocations(mobile))}
        onPress={() => openMobileNumber(mobile.id)}
      />
    );
  };

  const activeBlob =
    segment === 'addresses' ? addressesBlob : mobileNumbersBlob;
  const copy = SEGMENT_COPY[segment];
  const addressCount = current.length + old.length;
  const segmentIsEmpty =
    segment === 'addresses' ? addressCount === 0 : mobileNumbers.length === 0;
  // With nothing in either segment there is nothing to switch between, so
  // the control goes and the empty state stands alone (Det-List-Empty).
  const nothingAnywhere =
    !addressesBlob.loading &&
    !mobileNumbersBlob.loading &&
    addressesBlob.loadError == null &&
    mobileNumbersBlob.loadError == null &&
    addressCount === 0 &&
    mobileNumbers.length === 0;

  return (
    <Screen edges={TAB_SCREEN_EDGES} noPadding>
      <TabScreenHeader title="Details" collapsed={titleCollapse.collapsed} />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentOffset={rememberedScroll.contentOffset}
        onScroll={(event) => {
          rememberedScroll.onScroll(event);
          titleCollapse.onScroll(event);
        }}
        scrollEventThrottle={rememberedScroll.scrollEventThrottle}
      >
        <OfflineBanner />

        {!nothingAnywhere && (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              // The sheet leaves 12 under the control, exactly between `sm`
              // and `md`; a tie rounds up.
              paddingBottom: theme.spacing.md,
            }}
          >
            <SegmentedControl
              segments={SEGMENTS}
              value={segment}
              onChange={setSegment}
              accessibilityLabel="Addresses or Mobile Numbers"
            />
          </View>
        )}

        {activeBlob.loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : activeBlob.loadError != null ? (
          <View
            style={[
              styles.centered,
              {
                gap: theme.spacing.md,
                paddingHorizontal: theme.spacing.gutter,
              },
            ]}
          >
            <InlineNotice
              tone="destructive"
              message={describeVaultLoadError(
                activeBlob.loadError,
                copy.loadSubject,
              )}
            />
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => void activeBlob.reload()}
            />
          </View>
        ) : segmentIsEmpty ? (
          <View style={styles.centered}>
            <EmptyState
              icon={copy.icon}
              title={copy.emptyTitle}
              description="Add them on the web and they show up here."
              actionLabel="Open the web app"
              actionIcon="external"
              actionIconPosition="trailing"
              actionVariant="secondary"
              onAction={() => void Linking.openURL(webAppPath(copy.webPath))}
            />
          </View>
        ) : segment === 'addresses' ? (
          <>
            {current.length > 0 && (
              <ListSection title="Current" count={current.length}>
                {current.map(renderAddressRow)}
              </ListSection>
            )}
            {old.length > 0 && (
              <ListSection
                title="Old"
                count={old.length}
                collapsible
                defaultCollapsed
                style={
                  current.length > 0
                    ? { marginTop: theme.spacing.md }
                    : undefined
                }
              >
                {old.map(renderAddressRow)}
              </ListSection>
            )}
          </>
        ) : (
          <ListSection title="Mobile Numbers" count={mobileNumbers.length}>
            {mobileNumbers.map(renderMobileNumberRow)}
          </ListSection>
        )}
      </ScrollView>

      {/* The sheet pads this 10 × 16; `sm` is the nearest step to 10. */}
      {/* The empty state already says where Details are added, with a
          link; the lists say it here instead (Det-List vs Det-List-Empty). */}
      {!segmentIsEmpty && (
        <Text
          variant="caption"
          color="mutedForeground"
          style={{
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          Details are added and edited on the web.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
