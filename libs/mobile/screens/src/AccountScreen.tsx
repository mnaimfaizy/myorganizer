import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import {
  BottomSheet,
  Button,
  ConfirmSheet,
  Icon,
  ListRow,
  ListSection,
  MenuSheet,
  OfflineBanner,
  Screen,
  Switch,
  Text,
  TextField,
  useTheme,
} from '@myorganizer/mobile/ui';
import { TAB_SCREEN_EDGES, TabScreenHeader } from './TabScreenHeader';
import { useAccountScreenState } from './useAccountScreenState';

export function AccountScreen(): React.JSX.Element {
  const theme = useTheme();
  const { user } = useAuth();
  const { lock } = useVaultSession();
  const accountState = useAccountScreenState();
  // The passphrase typed into the enable sheet. Held only while the sheet is
  // open and dropped as it closes, so it never outlives the one check it is for.
  const [enablePassphrase, setEnablePassphrase] = useState('');

  const closeBiometricEnable = (): void => {
    accountState.setShowBiometricEnable(false);
    accountState.setBiometricError(null);
    setEnablePassphrase('');
  };

  useFocusEffect(
    useCallback(() => {
      // Trigger state refresh on focus
      // The hook handles this internally via refreshKey
    }, []),
  );

  const initials = useMemo(() => {
    if (!user) return '?';
    const first = user.firstName?.charAt(0)?.toUpperCase() ?? '';
    const last = user.lastName?.charAt(0)?.toUpperCase() ?? '';
    return (first + last).slice(0, 2) || '?';
  }, [user]);

  const autoLockDelayOptions = [
    { id: 'immediately', label: 'Immediately', value: 'immediately' as const },
    { id: '1m', label: '1 minute', value: '1m' as const },
    { id: '5m', label: '5 minutes', value: '5m' as const },
    { id: '15m', label: '15 minutes', value: '15m' as const },
  ];

  const appearanceOptions = [
    { id: 'system', label: 'System', value: 'system' as const },
    { id: 'light', label: 'Light', value: 'light' as const },
    { id: 'dark', label: 'Dark', value: 'dark' as const },
  ];

  return (
    <>
      <Screen edges={TAB_SCREEN_EDGES} style={styles.container}>
        <TabScreenHeader title="Account" />

        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          scrollIndicatorInsets={{
            right: 1,
            bottom: 1,
          }}
        >
          <View style={[styles.content, { gap: theme.spacing.md }]}>
            {/* User Header */}
            <View
              style={[
                styles.userHeader,
                { paddingHorizontal: theme.spacing.md },
              ]}
            >
              <View
                style={[styles.avatar, { backgroundColor: theme.colors.brand }]}
              >
                <Text variant="title" color="foreground">
                  {initials}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text variant="titleLg">
                  {user?.firstName} {user?.lastName}
                </Text>
                <Text variant="bodySm" color="mutedForeground">
                  {user?.email}
                </Text>
                <Text variant="caption" color="mutedForeground">
                  Settings on this device don't sync
                </Text>
              </View>
            </View>

            {/* Security Section */}
            <ListSection title="Security">
              <ListRow title="Lock Vault Now" onPress={() => lock('manual')} />

              <ListRow
                title="Biometric Unlock"
                subtitle={
                  accountState.biometricLabel === 'Not available on this device'
                    ? 'Set up biometrics in Settings'
                    : accountState.biometricLabel
                }
                trailing={
                  accountState.biometricLabel === 'Loading...' ? (
                    <></>
                  ) : (
                    <Switch
                      value={accountState.biometricEnabled}
                      onValueChange={(value) => {
                        if (value && accountState.biometricDisabled) {
                          accountState.setShowBiometricEnable(true);
                        } else if (!value && accountState.biometricEnabled) {
                          accountState.setShowBiometricDisableConfirm(true);
                        }
                      }}
                      disabled={
                        accountState.biometricLabel === 'Loading...' ||
                        accountState.biometricLabel ===
                          'Not available on this device'
                      }
                    />
                  )
                }
              />

              <ListRow
                title="Auto-Lock"
                subtitle={accountState.autoLockLabel}
                onPress={() => accountState.setShowAutoLockMenu(true)}
              />

              <ListRow
                title="Keep Screen Awake"
                subtitle="During shopping trips"
                trailing={
                  <Switch
                    value={accountState.keepScreenAwake}
                    onValueChange={(value) =>
                      accountState.handleKeepScreenAwakeChange(value)
                    }
                  />
                }
              />
            </ListSection>

            {/* Appearance Section */}
            <ListSection title="Appearance">
              <ListRow
                title="Theme"
                subtitle={accountState.appearanceLabel}
                onPress={() => accountState.setShowAppearanceMenu(true)}
              />
            </ListSection>

            {/* Manage on Web Section */}
            <ListSection title="Manage">
              <ListRow
                title="Manage on the Web"
                subtitle="Settings that sync across devices"
                trailing={<Icon name="chevronRight" />}
                onPress={() => {
                  // TODO: Open web app
                }}
              />
            </ListSection>

            {/* About Section */}
            <ListSection title="About">
              <ListRow title="Version" subtitle="1.0.0" />
              <ListRow title="Build" subtitle="1" />
              <ListRow
                title="Privacy Policy"
                trailing={<Icon name="chevronRight" />}
                onPress={() => {
                  // TODO: Open privacy policy
                }}
              />
              <ListRow
                title="Terms of Service"
                trailing={<Icon name="chevronRight" />}
                onPress={() => {
                  // TODO: Open terms of service
                }}
              />
            </ListSection>

            {/* Logout */}
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <Button
                label="Log Out"
                variant="destructive"
                onPress={() => accountState.setShowLogoutConfirm(true)}
              />
            </View>
          </View>
        </ScrollView>

        <OfflineBanner />
      </Screen>

      {/* Biometric Enable Sheet */}
      <BottomSheet
        visible={accountState.showBiometricEnable}
        onDismiss={() => {
          if (!accountState.biometricBusy) closeBiometricEnable();
        }}
        title="Turn on Biometric Unlock?"
      >
        <Text variant="body" color="mutedForeground">
          Enter your passphrase, then pass the biometric check. Your key stays
          on this device, and your passphrase and Recovery Key keep working.
        </Text>

        <View style={{ marginTop: theme.spacing.md }}>
          <TextField
            label="Passphrase"
            value={enablePassphrase}
            onChangeText={setEnablePassphrase}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!accountState.biometricBusy}
            onSubmitEditing={() => {
              if (enablePassphrase.length > 0) {
                void accountState
                  .handleBiometricEnable(enablePassphrase)
                  .then(() => setEnablePassphrase(''));
              }
            }}
          />
        </View>

        {accountState.biometricError != null && (
          <View
            style={[styles.noticeContainer, { marginTop: theme.spacing.md }]}
          >
            <Text variant="bodySm" color="destructive">
              {accountState.biometricError}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.actions,
            { gap: theme.spacing.sm, marginTop: theme.spacing.lg },
          ]}
        >
          <Button
            label="Turn On"
            icon="biometric"
            busy={accountState.biometricBusy}
            disabled={
              accountState.biometricBusy || enablePassphrase.length === 0
            }
            onPress={() =>
              void accountState
                .handleBiometricEnable(enablePassphrase)
                .then(() => setEnablePassphrase(''))
            }
          />
          <Button
            label="Not Now"
            variant="ghost"
            disabled={accountState.biometricBusy}
            onPress={closeBiometricEnable}
          />
        </View>
      </BottomSheet>

      {/* Biometric Disable Confirmation */}
      <ConfirmSheet
        visible={accountState.showBiometricDisableConfirm}
        onCancel={() => accountState.setShowBiometricDisableConfirm(false)}
        title="Turn off Biometric Unlock?"
        message="You'll need your passphrase to unlock your vault."
        confirmLabel="Turn Off"
        destructive
        busy={accountState.biometricBusy}
        onConfirm={() => void accountState.handleBiometricDisable()}
      />

      {/* Auto-Lock Menu */}
      <BottomSheet
        visible={accountState.showAutoLockMenu}
        onDismiss={() => accountState.setShowAutoLockMenu(false)}
        title="Auto-Lock Delay"
      >
        <Text
          variant="bodySm"
          color="mutedForeground"
          style={[{ marginBottom: theme.spacing.md }]}
        >
          The privacy cover goes up immediately when you leave the app, whatever
          the delay.
        </Text>
        <View style={{ gap: theme.spacing.xs }}>
          {autoLockDelayOptions.map((option) => (
            <ListRow
              key={option.id}
              title={option.label}
              onPress={() => {
                accountState.handleAutoLockChange(option.value);
                accountState.setShowAutoLockMenu(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>

      {/* Appearance Menu */}
      <MenuSheet
        visible={accountState.showAppearanceMenu}
        title="Theme"
        items={appearanceOptions.map((option) => ({
          id: option.id,
          label: option.label,
          onPress: () => accountState.handleAppearanceChange(option.value),
        }))}
        onDismiss={() => accountState.setShowAppearanceMenu(false)}
      />

      {/* Logout Confirmation */}
      <ConfirmSheet
        visible={accountState.showLogoutConfirm}
        onCancel={() => accountState.setShowLogoutConfirm(false)}
        title="Log Out?"
        message="You'll be logged out of this device. Biometric Unlock will be removed."
        confirmLabel="Log Out"
        destructive
        onConfirm={() => void accountState.handleLogout()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 16,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  actions: {
    flexDirection: 'column',
  },
  noticeContainer: {
    paddingVertical: 8,
  },
});
