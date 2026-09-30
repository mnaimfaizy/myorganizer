import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  Button,
  EmptyState,
  InlineNotice,
  ListSection,
  OfflineBanner,
  Screen,
  useLargeTitleCollapse,
  useTheme,
  type IconName,
} from '@myorganizer/mobile/ui';
import {
  formatMobileNumber,
  formatStreetLine,
  groupUsageLocations,
  USAGE_LOCATIONS_COPY,
  type ContactKind,
  type DecryptedAddress,
  type DecryptedMobileNumber,
} from './contactModel';
import { DetailTitle, useDetailNavigationTitle } from './DetailTitle';
import { DETAILS_ROUTES, type DetailsStackParamList } from './detailsStack';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import {
  UsageLocationProgress,
  UsageLocationRow,
} from './UsageLocationSection';
import { useContactRecord } from './useContactRecord';
import { describeVaultLoadError } from './vaultLoadError';

/** How each kind of record is named and recognised on this screen. */
const CONTACT_NAMING = {
  address: {
    fallbackLabel: 'Address',
    line: (contact: DecryptedAddress | DecryptedMobileNumber) =>
      formatStreetLine(contact as DecryptedAddress),
    icon: 'home',
  },
  mobileNumber: {
    fallbackLabel: 'Mobile Number',
    line: (contact: DecryptedAddress | DecryptedMobileNumber) =>
      formatMobileNumber(contact as DecryptedMobileNumber),
    icon: 'phone',
  },
} as const satisfies Record<
  ContactKind,
  {
    fallbackLabel: string;
    line: (contact: DecryptedAddress | DecryptedMobileNumber) => string;
    icon: IconName;
  }
>;

/**
 * Every Usage Location of one Address or Mobile Number (Det-UL): who is still
 * to be told, by priority, and who has been, most recently first — with the
 * "n of m notified" progress over both. Ticking notified is the only edit;
 * a tick is an Unconfirmed Edit that stays in its group until the server
 * confirms it, and a refused one is put back on its row with the reason and
 * Retry. Creating, editing, or deleting a Usage Location stays web-only.
 */
export function UsageLocationsScreen(): React.JSX.Element {
  const theme = useTheme();
  const { kind, contactId } =
    useRoute<
      RouteProp<DetailsStackParamList, typeof DETAILS_ROUTES.usageLocations>
    >().params;

  const { loading, loadError, reload, contact, usageLocations, edits } =
    useContactRecord(kind, contactId);

  const naming = CONTACT_NAMING[kind];
  const label = contact?.label?.trim() || naming.fallbackLabel;
  const titleCollapse = useLargeTitleCollapse();
  useDetailNavigationTitle('Usage Locations', titleCollapse.collapsed, label);

  const now = useMemo(() => new Date(), []);
  const { toNotify, notified } = groupUsageLocations(
    usageLocations,
    edits.pendingId,
  );

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
            message={describeVaultLoadError(loadError, 'these Usage Locations')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : contact === null ? (
        <View style={styles.centered}>
          <EmptyState
            icon={naming.icon}
            title={`${naming.fallbackLabel} not found`}
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
            title="Usage Locations"
            size="titleLg"
            hint={USAGE_LOCATIONS_COPY[kind].subtitle(
              label,
              naming.line(contact),
            )}
          />

          {usageLocations.length === 0 ? (
            <EmptyState
              title="No Usage Locations yet"
              description="Add them on the web and they show up here."
            />
          ) : (
            <>
              <UsageLocationProgress
                kind={kind}
                usageLocations={usageLocations}
              />
              {toNotify.length > 0 && (
                <ListSection
                  title={`To notify · ${toNotify.length} · by priority`}
                >
                  {toNotify.map((location) => (
                    <UsageLocationRow
                      key={location.id}
                      location={location}
                      edits={edits}
                      now={now}
                    />
                  ))}
                </ListSection>
              )}
              {notified.length > 0 && (
                <ListSection
                  title="Notified"
                  count={notified.length}
                  style={
                    toNotify.length > 0
                      ? { marginTop: theme.spacing.sm }
                      : undefined
                  }
                >
                  {notified.map((location) => (
                    <UsageLocationRow
                      key={location.id}
                      location={location}
                      edits={edits}
                      now={now}
                    />
                  ))}
                </ListSection>
              )}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
