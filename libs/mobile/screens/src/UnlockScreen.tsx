import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import { useVaultSession } from '@myorganizer/mobile/feat-vault';
import {
  Button,
  InlineNotice,
  Screen,
  Text,
  TextField,
  useTheme,
} from '@myorganizer/mobile/ui';

/**
 * Maps an unlock failure to user-facing copy. A server `response` means the
 * meta fetch failed; an Axios transport error (no response) is a network issue;
 * anything else is the AES-GCM auth-tag failure of a wrong passphrase.
 */
function describeUnlockError(err: unknown): string {
  const e = err as {
    response?: { status?: number };
    isAxiosError?: boolean;
    code?: string;
  };
  if (e?.response) {
    if (e.response.status === 404) return 'No vault found for your account.';
    return 'Could not load your vault. Please try again.';
  }
  if (e?.isAxiosError || e?.code === 'ERR_NETWORK') {
    return 'Network error — check your connection and try again.';
  }
  return 'Incorrect passphrase. Please try again.';
}

/**
 * Prompts an authenticated User for their vault passphrase, derives the Master
 * Key via the crypto adapter, and establishes the in-memory unlocked session.
 * On success the root navigator advances; the passphrase is never persisted.
 */
export function UnlockScreen(): React.JSX.Element {
  const { unlock } = useVaultSession();
  const { logout } = useAuth();
  const theme = useTheme();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = passphrase.length > 0 && !submitting;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await unlock(passphrase);
    } catch (err) {
      setError(describeUnlockError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={[styles.content, { gap: theme.spacing.md }]}>
        <Text variant="titleLg">Unlock your vault</Text>
        <Text variant="caption">
          Enter your passphrase to decrypt your data on this device.
        </Text>

        <TextField
          label="Passphrase"
          value={passphrase}
          onChangeText={setPassphrase}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
          placeholder="••••••••"
          returnKeyType="go"
          onSubmitEditing={() => void handleSubmit()}
        />

        {error != null && <InlineNotice tone="destructive" message={error} />}

        <Button
          label={submitting ? 'Unlocking…' : 'Unlock'}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
          style={{ marginTop: theme.spacing.sm }}
        />

        <Button
          label="Sign out"
          variant="ghost"
          onPress={() => void logout()}
          disabled={submitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});
