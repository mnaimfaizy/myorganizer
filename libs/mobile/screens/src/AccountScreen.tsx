import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  DEFAULT_AUTO_LOCK_DELAY,
  readAppVersion,
  type AppVersion,
} from '@myorganizer/mobile/core';
import {
  useAuth,
  WEB_APP_URL,
  webAppPath,
} from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import {
  BottomSheet,
  Button,
  ConfirmSheet,
  Icon,
  InlineNotice,
  ListRow,
  ListSection,
  MenuSheet,
  OfflineBanner,
  Screen,
  SegmentedControl,
  Switch,
  Text,
  TextField,
  useLargeTitleCollapse,
  useTheme,
} from '@myorganizer/mobile/ui';
import {
  APPEARANCE_SEGMENTS,
  AUTO_LOCK_CHOICES,
  autoLockOptions,
  describeBiometricEnable,
  describeBiometricRow,
  displayName,
  formatAppVersion,
  initialsFor,
  type AccountPlatform,
} from './accountScreenLogic';
import { TAB_SCREEN_EDGES, TabScreenHeader } from './TabScreenHeader';
import { useAccountScreenState } from './useAccountScreenState';

/** The avatar's side, as the Account sheet draws it. No token carries 56. */
const AVATAR_SIZE = 56;

/**
 * How far the Biometric Unlock row is dimmed when the device has no biometric
 * enrolled — the sheet's 0.55, lighter than a disabled row's 0.4 so the line
 * saying where to set it up stays readable.
 */
const UNAVAILABLE_OPACITY = 0.55;

const PLATFORM: AccountPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

export type { AppVersion };

export interface AccountScreenProps {
  /**
   * What the About section's Version row shows. Read from the native bundle
   * (`readAppVersion`) unless a caller supplies it; the row is left out when
   * there is none, rather than showing a number written here by hand that
   * goes stale on the next release.
   */
  appVersion?: AppVersion | null;
}

/** The trailing note on a section whose settings belong to this device. */
function ThisPhone(): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={[styles.inline, { gap: theme.spacing.xs }]}>
      <Icon name="phone" size={12} color="mutedForeground" />
      <Text variant="caption" color="mutedForeground">
        this phone
      </Text>
    </View>
  );
}

/**
 * A switch drawn for sight inside a row that is itself announced as the
 * switch (`ListRow`'s `toggle`), so a screen reader meets it once.
 */
function RowSwitch({
  value,
  onValueChange,
  disabled,
  label,
  placeholder = false,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  /** Holds the switch's place without showing an answer — still loading. */
  placeholder?: boolean;
}): React.JSX.Element {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents={placeholder ? 'none' : 'auto'}
      style={placeholder && styles.placeholder}
    >
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** A row that leaves the app for the web: the sheet's external-link glyph. */
function ExternalGlyph(): React.JSX.Element {
  return <Icon name="external" size={18} color="mutedForeground" />;
}

export function AccountScreen({
  appVersion = readAppVersion(),
}: AccountScreenProps = {}): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const { lock, biometric } = useVaultSession();
  const accountState = useAccountScreenState();
  const { collapsed, onScroll, scrollEventThrottle } = useLargeTitleCollapse();
  // The passphrase typed into the enable sheet. Held only while the sheet is
  // open and dropped as it closes, so it never outlives the one check it is for.
  const [enablePassphrase, setEnablePassphrase] = useState('');
  const enableOpen = accountState.sheet === 'biometricEnable';

  useEffect(() => {
    if (!enableOpen) setEnablePassphrase('');
  }, [enableOpen]);

  const biometricRow = describeBiometricRow(
    biometric.state,
    biometric.method,
    PLATFORM,
  );
  const autoLockItems = autoLockOptions(DEFAULT_AUTO_LOCK_DELAY).map(
    (option) => ({
      id: option.value,
      label: option.label,
      selected: option.value === accountState.autoLockDelay,
      onPress: () => accountState.handleAutoLockChange(option.value),
    }),
  );

  const name = displayName(user);

  const submitEnable = (): void => {
    if (enablePassphrase.length === 0 || accountState.biometricBusy) return;
    void accountState
      .handleBiometricEnable(enablePassphrase)
      .then(() => setEnablePassphrase(''));
  };

  const closeEnable = (): void => {
    if (accountState.biometricBusy) return;
    accountState.closeSheet();
  };

  const biometricUnavailable = biometricRow.kind === 'unavailable';
  const biometricLoading = biometricRow.kind === 'loading';

  return (
    <>
      <Screen edges={TAB_SCREEN_EDGES} noPadding>
        <TabScreenHeader title="Account" collapsed={collapsed} />

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
        >
          <View
            style={[
              styles.inline,
              {
                marginHorizontal: theme.spacing.md,
                // The sheet draws a 14 gap, which rounds to `md`.
                gap: theme.spacing.md,
                paddingTop: theme.spacing.xs,
                paddingBottom: theme.spacing.sm,
              },
            ]}
          >
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.avatar, { backgroundColor: theme.colors.muted }]}
            >
              <Text variant="title">{initialsFor(user)}</Text>
            </View>
            <View style={styles.identity}>
              {name.length > 0 && (
                <Text variant="title" numberOfLines={1}>
                  {name}
                </Text>
              )}
              {user?.email != null && (
                <Text
                  variant="bodySm"
                  color="mutedForeground"
                  numberOfLines={1}
                >
                  {user.email}
                </Text>
              )}
            </View>
          </View>

          <InlineNotice
            variant="card"
            tone="info"
            icon="phone"
            message="Settings on this tab belong to this phone. They don’t sync to your other devices or to the web."
            style={{
              marginHorizontal: theme.spacing.md,
              // The sheet's 12 falls between two steps; a tie rounds up.
              marginTop: theme.spacing.md,
            }}
          />

          <ListSection title="Security" meta={<ThisPhone />} inset>
            <ListRow
              title="Lock Vault now"
              leadingIcon="lock"
              leadingIconColor="brand"
              onPress={() => lock('manual')}
            />
            <ListRow
              title="Biometric Unlock"
              subtitle={biometricRow.subtitle ?? undefined}
              leadingIcon={biometricRow.icon}
              toggle={{
                value: biometricRow.on,
                disabled: biometricUnavailable || biometricLoading,
              }}
              onPress={
                biometricUnavailable || biometricLoading
                  ? undefined
                  : () => accountState.handleBiometricToggle(!biometricRow.on)
              }
              style={biometricUnavailable && styles.unavailable}
              trailing={
                <RowSwitch
                  label="Biometric Unlock"
                  value={biometricRow.on}
                  disabled={biometricUnavailable}
                  placeholder={biometricLoading}
                  onValueChange={accountState.handleBiometricToggle}
                />
              }
            />
            <ListRow
              title="Auto-lock"
              leadingIcon="timer"
              accessibilityLabel={`Auto-lock, ${
                AUTO_LOCK_CHOICES[accountState.autoLockDelay].option
              }`}
              onPress={() => accountState.openSheet('autoLock')}
              trailing={
                <Text variant="body" color="mutedForeground" numberOfLines={1}>
                  {AUTO_LOCK_CHOICES[accountState.autoLockDelay].row}
                </Text>
              }
              chevron
            />
            <ListRow
              title="Keep screen awake on a trip"
              subtitle="While a Grocery List is open."
              leadingIcon="sun"
              toggle={{ value: accountState.keepScreenAwake }}
              onPress={() =>
                accountState.handleKeepScreenAwakeChange(
                  !accountState.keepScreenAwake,
                )
              }
              trailing={
                <RowSwitch
                  label="Keep screen awake on a trip"
                  value={accountState.keepScreenAwake}
                  onValueChange={accountState.handleKeepScreenAwakeChange}
                />
              }
            />
          </ListSection>

          <ListSection title="Appearance" meta={<ThisPhone />} inset>
            {/* The sheet pads the control 12 in, halfway between two steps. */}
            <View style={{ padding: theme.spacing.md }}>
              <SegmentedControl
                accessibilityLabel="Appearance"
                segments={APPEARANCE_SEGMENTS}
                value={accountState.appearance}
                onChange={accountState.handleAppearanceChange}
              />
            </View>
          </ListSection>

          <ListSection title="Manage on the web" inset>
            <ListRow
              title="Open the web app"
              subtitle="Vault export, Recovery Key, passphrase changes, and creating accounts or Vaults are managed on the web."
              leadingIcon="globe"
              trailing={<ExternalGlyph />}
              onPress={() => void Linking.openURL(WEB_APP_URL)}
            />
          </ListSection>

          <ListSection title="About" inset>
            {appVersion != null && (
              <ListRow
                title="Version"
                leadingIcon="info"
                trailing={
                  <Text
                    variant="body"
                    color="mutedForeground"
                    numberOfLines={1}
                    style={styles.figures}
                  >
                    {formatAppVersion(appVersion.version, appVersion.build)}
                  </Text>
                }
              />
            )}
            <ListRow
              title="Privacy"
              leadingIcon="shield"
              trailing={<ExternalGlyph />}
              onPress={() => void Linking.openURL(webAppPath('/privacy'))}
            />
            <ListRow
              title="Terms"
              leadingIcon="document"
              trailing={<ExternalGlyph />}
              onPress={() => void Linking.openURL(webAppPath('/terms'))}
            />
          </ListSection>

          <Button
            label="Log out"
            variant="destructive"
            icon="logout"
            onPress={() => accountState.openSheet('logout')}
            style={{
              marginTop: theme.spacing.lg,
              marginHorizontal: theme.spacing.md,
            }}
          />
        </ScrollView>

        <OfflineBanner />
      </Screen>

      {/* Not drawn on the Account page: built from the Foundation sheet
          parts, in the Account voice. The passphrase is asked for even
          though the Vault is unlocked (ADR 0108 decision 1). */}
      <BottomSheet
        visible={enableOpen}
        onDismiss={closeEnable}
        title="Turn on Biometric Unlock?"
      >
        <Text variant="bodySm" color="popoverForeground">
          {describeBiometricEnable(biometric.method, PLATFORM)}
        </Text>

        <View style={{ marginTop: theme.spacing.md }}>
          <TextField
            label="Passphrase"
            value={enablePassphrase}
            onChangeText={(text) => {
              setEnablePassphrase(text);
              if (accountState.biometricError != null) {
                accountState.setBiometricError(null);
              }
            }}
            error={accountState.biometricError ?? undefined}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            editable={!accountState.biometricBusy}
            onSubmitEditing={submitEnable}
          />
        </View>

        <View
          style={[
            styles.actions,
            { gap: theme.spacing.sm, marginTop: theme.spacing.lg },
          ]}
        >
          <Button
            label="Turn on"
            variant="brand"
            busy={accountState.biometricBusy}
            disabled={enablePassphrase.length === 0}
            onPress={submitEnable}
          />
          <Button
            label="Not now"
            variant="secondary"
            disabled={accountState.biometricBusy}
            onPress={closeEnable}
          />
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={accountState.sheet === 'biometricDisable'}
        title="Turn off Biometric Unlock?"
        message="Your key is removed from this phone. You’ll unlock with your passphrase until you turn it back on."
        confirmLabel="Turn off"
        cancelLabel="Keep it on"
        busy={accountState.biometricBusy}
        onConfirm={() => void accountState.handleBiometricDisable()}
        onCancel={accountState.closeSheet}
      />

      <MenuSheet
        visible={accountState.sheet === 'autoLock'}
        onDismiss={accountState.closeSheet}
        title="Auto-lock"
        lead="How long the app can sit in the background before the Vault locks."
        footnote="The privacy cover always goes up straight away, whatever you pick here."
        items={autoLockItems}
      />

      <ConfirmSheet
        visible={accountState.sheet === 'logout'}
        title="Log out?"
        message={[
          'Logging out also removes Biometric Unlock from this device.',
          'Your Vault stays on the server. Sign in again with your email and password.',
        ]}
        confirmLabel="Log out"
        destructive
        onConfirm={() => void accountState.handleLogout()}
        onCancel={accountState.closeSheet}
      />
    </>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  unavailable: {
    opacity: UNAVAILABLE_OPACITY,
  },
  placeholder: {
    opacity: 0,
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'column',
  },
});
