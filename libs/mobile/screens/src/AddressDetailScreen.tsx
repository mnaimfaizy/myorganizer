import React, { useCallback, useMemo, useState } from 'react';
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
import { useSensitiveCopy } from '@myorganizer/mobile/feat-vault';
import {
  Button,
  EmptyState,
  InlineNotice,
  OfflineBanner,
  Screen,
  Snackbar,
  StatusPill,
  Text,
  useLargeTitleCollapse,
  useTheme,
} from '@myorganizer/mobile/ui';
import { ContactFieldRow } from './ContactFieldRow';
import {
  addressFields,
  addressStatus,
  describeCopiedAll,
  formatAddressLine,
  isLegacyAddress,
  mapsUrlForAddress,
  type CopyableField,
} from './contactModel';
import { DetailTitle, useDetailNavigationTitle } from './DetailTitle';
import { DETAILS_ROUTES, type DetailsStackParamList } from './detailsStack';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { UsageLocationSection } from './UsageLocationSection';
import { useContactRecord } from './useContactRecord';
import { describeVaultLoadError } from './vaultLoadError';

/** The pill beside an Address's name, pinned to the status set. */
const STATUS_LABEL = {
  current: 'Current',
  old: 'Old',
} as const satisfies Record<ReturnType<typeof addressStatus>, string>;

/**
 * One Address's detail (Det-Address): its name large, Current or Old, and
 * every field as one tap-to-copy row; Copy all, then Open in Maps and Share —
 * the only ways an Address leaves the app; and who is still to be told it
 * moved, with the way to the whole Usage Locations list. Creating or editing
 * an Address stays web-only.
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
    loading,
    loadError,
    reload,
    contact: address,
    usageLocations,
    edits,
  } = useContactRecord('address', addressId);

  const { copy } = useSensitiveCopy();
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const titleCollapse = useLargeTitleCollapse();

  const title = address?.label?.trim() || 'Address';
  useDetailNavigationTitle(title, titleCollapse.collapsed);

  const fields = useMemo(
    () => (address === null ? [] : addressFields(address)),
    [address],
  );

  const copyField = useCallback(
    (field: CopyableField): void => {
      void copy(field.copyValue ?? field.value).then((message) => {
        if (message != null) setCopiedMessage(message);
      });
    },
    [copy],
  );

  const copyAll = useCallback((): void => {
    if (address === null) return;
    void copy(formatAddressLine(address)).then((message) => {
      const confirmation = describeCopiedAll(message, 'Address');
      if (confirmation != null) setCopiedMessage(confirmation);
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

  const seeAllUsageLocations = useCallback((): void => {
    navigation.navigate(DETAILS_ROUTES.usageLocations, {
      kind: 'address',
      contactId: addressId,
    });
  }, [navigation, addressId]);

  return (
    <Screen edges={STACK_SCREEN_EDGES} noPadding>
      <OfflineBanner />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View
          style={[
            styles.centered,
            { gap: theme.spacing.md, paddingHorizontal: theme.spacing.gutter },
          ]}
        >
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
            icon="home"
            title="Address not found"
            description="It may have been deleted on another device."
          />
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
          showsVerticalScrollIndicator={false}
          onScroll={titleCollapse.onScroll}
          scrollEventThrottle={titleCollapse.scrollEventThrottle}
        >
          <DetailTitle
            title={title}
            accessory={
              <StatusPill label={STATUS_LABEL[addressStatus(address)]} />
            }
            hint="Tap a line to copy it"
          />

          {fields.length > 0 && (
            <View
              style={[
                styles.card,
                {
                  marginHorizontal: theme.spacing.md,
                  borderRadius: theme.radii.lg,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
              ]}
            >
              {fields.map((field) => (
                <ContactFieldRow
                  key={field.id}
                  field={field}
                  onCopy={copyField}
                />
              ))}
            </View>
          )}

          {isLegacyAddress(address) && (
            // The sheet sets this 10 below the card; `sm` is the nearest step.
            <Text
              variant="caption"
              color="mutedForeground"
              style={{
                marginTop: theme.spacing.sm,
                marginHorizontal: theme.spacing.md,
              }}
            >
              Saved as a single line. Split it into fields on the web.
            </Text>
          )}

          <View
            style={{
              gap: theme.spacing.sm,
              paddingTop: theme.spacing.md,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <Button
              label="Copy all"
              variant="secondary"
              icon="copy"
              onPress={copyAll}
            />
            <View style={[styles.pair, { gap: theme.spacing.sm }]}>
              <Button
                label="Open in Maps"
                variant="secondary"
                icon="mapPin"
                onPress={openInMaps}
                style={styles.half}
              />
              <Button
                label="Share"
                variant="secondary"
                icon="share"
                onPress={shareAddress}
                style={styles.half}
              />
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.lg }}>
            <UsageLocationSection
              kind="address"
              usageLocations={usageLocations}
              edits={edits}
              onSeeAll={seeAllUsageLocations}
            />
          </View>
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
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  pair: {
    flexDirection: 'row',
  },
  half: {
    flexGrow: 1,
    flexBasis: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
