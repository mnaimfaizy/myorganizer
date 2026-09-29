import React, { useCallback, useMemo, useState } from 'react';
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
import { useSensitiveCopy } from '@myorganizer/mobile/feat-vault';
import {
  Button,
  EmptyState,
  InlineNotice,
  OfflineBanner,
  Screen,
  Snackbar,
  Text,
  useLargeTitleCollapse,
  useTheme,
} from '@myorganizer/mobile/ui';
import { ContactFieldRow } from './ContactFieldRow';
import {
  formatMobileNumber,
  isLegacyMobileNumber,
  mobileNumberFields,
  type CopyableField,
} from './contactModel';
import { DetailTitle, useDetailNavigationTitle } from './DetailTitle';
import { DETAILS_ROUTES, type DetailsStackParamList } from './detailsStack';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { UsageLocationSection } from './UsageLocationSection';
import { useContactRecord } from './useContactRecord';
import { describeVaultLoadError } from './vaultLoadError';

/**
 * One Mobile Number's detail (Det-Mobile): its name, the whole number set
 * large with its country code and number beneath, each one tap-to-copy; Copy
 * number and Share — the only ways a Mobile Number leaves the app; and who is
 * still to be told it changed, with the way to the whole Usage Locations
 * list. Creating or editing a Mobile Number stays web-only.
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
    loading,
    loadError,
    reload,
    contact: mobile,
    usageLocations,
    edits,
  } = useContactRecord('mobileNumber', mobileNumberId);

  const { copy } = useSensitiveCopy();
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const titleCollapse = useLargeTitleCollapse();

  const title = mobile?.label?.trim() || 'Mobile Number';
  useDetailNavigationTitle(title, titleCollapse.collapsed);

  const fields = useMemo(
    () => (mobile === null ? [] : mobileNumberFields(mobile)),
    [mobile],
  );

  const copyValue = useCallback(
    (value: string): void => {
      void copy(value).then((message) => {
        if (message != null) setCopiedMessage(message);
      });
    },
    [copy],
  );

  const copyField = useCallback(
    (field: CopyableField): void => copyValue(field.copyValue ?? field.value),
    [copyValue],
  );

  const copyNumber = useCallback((): void => {
    if (mobile === null) return;
    copyValue(formatMobileNumber(mobile));
  }, [mobile, copyValue]);

  const shareMobileNumber = useCallback((): void => {
    if (mobile === null) return;
    void Share.share({ message: formatMobileNumber(mobile) });
  }, [mobile]);

  const seeAllUsageLocations = useCallback((): void => {
    navigation.navigate(DETAILS_ROUTES.usageLocations, {
      kind: 'mobileNumber',
      contactId: mobileNumberId,
    });
  }, [navigation, mobileNumberId]);

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
            icon="phone"
            title="Mobile Number not found"
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
          <DetailTitle title={title} hint="Tap the number to copy it" />

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

          {isLegacyMobileNumber(mobile) && (
            // The sheet sets this 10 below the card; `sm` is the nearest step.
            <Text
              variant="caption"
              color="mutedForeground"
              style={{
                marginTop: theme.spacing.sm,
                marginHorizontal: theme.spacing.md,
              }}
            >
              Saved without a country code. Add one on the web.
            </Text>
          )}

          <View
            style={[
              styles.pair,
              {
                gap: theme.spacing.sm,
                paddingTop: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
              },
            ]}
          >
            <Button
              label="Copy number"
              variant="secondary"
              icon="copy"
              onPress={copyNumber}
              style={styles.half}
            />
            <Button
              label="Share"
              variant="secondary"
              icon="share"
              onPress={shareMobileNumber}
              style={styles.half}
            />
          </View>

          <View style={{ marginTop: theme.spacing.lg }}>
            <UsageLocationSection
              kind="mobileNumber"
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
