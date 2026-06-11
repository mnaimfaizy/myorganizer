import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import {
  useVaultSession,
  pullDecryptedBlob,
} from '@myorganizer/mobile/feat-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  ScreenContainer,
  ThemedText,
  ThemedButton,
  useTheme,
} from '@myorganizer/mobile/ui';

/** Minimal view model for a decrypted task — only the fields this screen renders. */
interface DecryptedTask {
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  archived?: boolean;
}

function describeTasksError(err: unknown): string {
  const e = err as {
    response?: { status?: number };
    isAxiosError?: boolean;
    code?: string;
  };
  if (e?.response) return 'Could not load your tasks. Please try again.';
  if (e?.isAxiosError || e?.code === 'ERR_NETWORK') {
    return 'Network error — check your connection and try again.';
  }
  return 'Could not decrypt your tasks.';
}

/** Normalizes the decrypted payload (a Task[] or { tasks: [...] }) to an array. */
function toTaskArray(raw: unknown): DecryptedTask[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { tasks?: unknown })?.tasks)
      ? (raw as { tasks: unknown[] }).tasks
      : [];
  return (list as DecryptedTask[]).filter((task) => !task?.archived);
}

/**
 * Read-only Tasks list: once the Vault is unlocked, pull the Tasks blob, decrypt
 * it on-device with the Master Key, and render it. One-way pull only — no write,
 * edit, or push from mobile this phase.
 */
export function TasksScreen(): React.JSX.Element {
  const { logout } = useAuth();
  const { masterKey, vaultApi, lock } = useVaultSession();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DecryptedTask[]>([]);

  const load = useCallback(async (): Promise<void> => {
    if (!masterKey) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await pullDecryptedBlob({
        vaultApi,
        masterKey,
        type: VaultBlobType.Tasks,
      });
      setTasks(raw == null ? [] : toTaskArray(raw));
    } catch (err) {
      setError(describeTasksError(err));
    } finally {
      setLoading(false);
    }
  }, [masterKey, vaultApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<DecryptedTask>): React.JSX.Element => {
      const meta = [item.status, item.priority]
        .filter((part): part is string => Boolean(part))
        .join(' · ');
      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            },
          ]}
        >
          <ThemedText variant="label">
            {item.title ?? 'Untitled task'}
          </ThemedText>
          {meta.length > 0 && <ThemedText variant="caption">{meta}</ThemedText>}
        </View>
      );
    },
    [theme],
  );

  return (
    <ScreenContainer>
      <View style={[styles.header, { marginBottom: theme.spacing.md }]}>
        <ThemedText variant="heading">Tasks</ThemedText>
        <View style={[styles.headerActions, { gap: theme.spacing.sm }]}>
          <ThemedButton
            label="Lock"
            variant="ghost"
            onPress={lock}
            style={styles.headerButton}
          />
          <ThemedButton
            label="Sign out"
            variant="ghost"
            onPress={() => void logout()}
            style={styles.headerButton}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
          <ThemedText variant="body" color="destructive">
            {error}
          </ThemedText>
          <ThemedButton
            label="Try again"
            variant="outline"
            onPress={() => void load()}
          />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.centered}>
          <ThemedText variant="body">No tasks yet.</ThemedText>
          <ThemedText variant="caption" style={{ marginTop: theme.spacing.xs }}>
            Tasks you add on the web will appear here.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item, index) => item.id ?? String(index)}
          renderItem={renderItem}
          contentContainerStyle={{
            gap: theme.spacing.sm,
            paddingBottom: theme.spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 0,
  },
  card: {
    borderWidth: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
