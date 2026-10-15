import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useAuth, webAppPath } from '@myorganiser/mobile/feat-auth';
import {
  BottomSheet,
  Button,
  ConfirmSheet,
  InlineNotice,
  Text,
  TextField,
  useTheme,
} from '@myorganiser/mobile/ui';
import {
  USER_DELETION_CONFIRMATION,
  canRequestUserDeletion,
  describeUserDeletionError,
} from './userDeletionLogic';

/** Where the web app exports a Vault: its Escape Copy lives there. */
const ESCAPE_COPY_PATH = '/dashboard/vault';

type Step = 'escapeCopy' | 'confirm';

export interface UserDeletionSheetsProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * User Deletion from the Account tab, in two sheets.
 *
 * The first leads with the Escape Copy. The app cannot export a Vault, so it
 * says so and sends the User to the web app to download one; continuing
 * without one is their call. The second asks for the account password and
 * DELETE typed out. No design was approved for either (ADR 0110): they are
 * the app's confirm and form sheets.
 *
 * A refusal leaves everything as it was and says why on the sheet. Success
 * needs nothing here: `deleteAccount` wipes this User's local data and the
 * app goes to sign-in, which unmounts the Account tab.
 */
export function UserDeletionSheets({
  visible,
  onClose,
}: UserDeletionSheetsProps): React.JSX.Element {
  const theme = useTheme();
  const { deleteAccount } = useAuth();
  const [step, setStep] = useState<Step>('escapeCopy');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The password is held only while the sheets are up, and every closing
  // starts the flow again from the Escape Copy.
  useEffect(() => {
    if (visible) return;
    setStep('escapeCopy');
    setPassword('');
    setConfirmation('');
    setPasswordError(null);
    setNotice(null);
  }, [visible]);

  const canSubmit = canRequestUserDeletion({ password, confirmation });

  const close = (): void => {
    if (!busy) onClose();
  };

  const submit = (): void => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setPasswordError(null);
    setNotice(null);
    deleteAccount(password).catch((error: unknown) => {
      const failure = describeUserDeletionError(error);
      if (failure.placement === 'password') setPasswordError(failure.message);
      else setNotice(failure.message);
      setBusy(false);
    });
  };

  return (
    <>
      <ConfirmSheet
        visible={visible && step === 'escapeCopy'}
        title="Delete your account?"
        message={[
          'This deletes your account and everything stored on the server for it, including your encrypted Vault. It can’t be undone.',
          'To keep your data, download an Escape Copy first. The app can’t make one: open the web app’s Vault page to download it, then come back here.',
        ]}
        confirmLabel="Continue"
        secondaryLabel="Get an Escape Copy on the web"
        secondaryIcon="external"
        onSecondary={() => void Linking.openURL(webAppPath(ESCAPE_COPY_PATH))}
        onConfirm={() => setStep('confirm')}
        onCancel={close}
      />

      <BottomSheet
        visible={visible && step === 'confirm'}
        onDismiss={close}
        title="Confirm account deletion"
      >
        <Text variant="bodySm" color="popoverForeground">
          Enter your account password and type {USER_DELETION_CONFIRMATION} to
          delete your account. This signs you out on every device.
        </Text>

        <View
          style={[
            styles.fields,
            { gap: theme.spacing.md, marginTop: theme.spacing.md },
          ]}
        >
          <TextField
            label="Account password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError != null) setPasswordError(null);
            }}
            error={passwordError ?? undefined}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            editable={!busy}
          />
          <TextField
            label={`Type ${USER_DELETION_CONFIRMATION} to confirm`}
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="go"
            editable={!busy}
            onSubmitEditing={submit}
          />
        </View>

        {notice != null && (
          <InlineNotice
            tone="destructive"
            message={notice}
            style={{ marginTop: theme.spacing.md }}
          />
        )}

        <View
          style={[
            styles.actions,
            { gap: theme.spacing.sm, marginTop: theme.spacing.lg },
          ]}
        >
          <Button
            label="Delete my account"
            variant="destructive"
            busy={busy}
            disabled={!canSubmit}
            onPress={submit}
          />
          <Button
            label="Back"
            variant="secondary"
            disabled={busy}
            onPress={() => setStep('escapeCopy')}
          />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  fields: {
    flexDirection: 'column',
  },
  actions: {
    flexDirection: 'column',
  },
});
