import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import {
  isNetworkError,
  newRecordId,
  useVaultBlob,
  useVaultSession,
  type VaultBlobWriteErrorKind,
} from '@myorganizer/mobile/feat-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  deleteVaultRecord,
  putVaultRecord,
  type Task,
} from '@myorganizer/vault-core/portable';
import {
  ScreenContainer,
  ThemedText,
  ThemedButton,
  ThemedInput,
  useTheme,
} from '@myorganizer/mobile/ui';

/**
 * A decrypted task as this screen reads it. The payload is decrypted JSON, so
 * every field but `id` is a claim; the whole entry is kept and spread back on
 * edit so fields this screen does not know survive the round trip.
 */
type DecryptedTask = Partial<Task> & { id: string };

function describeLoadError(err: unknown): string {
  if (isNetworkError(err)) {
    return 'Network error — check your connection and try again.';
  }
  if ((err as { response?: unknown })?.response) {
    return 'Could not load your tasks. Please try again.';
  }
  return 'Could not decrypt your tasks.';
}

const WRITE_ERROR_MESSAGES = {
  conflict:
    'These tasks changed on another device. Reload to see the latest, then make your change again.',
  network: 'Your change was not saved — check your connection and try again.',
  failed: 'Your change was not saved. Please try again.',
} as const satisfies Record<VaultBlobWriteErrorKind, string>;

/** The entries of a decrypted Tasks payload this screen can show and edit. */
function toVisibleTasks(records: unknown): DecryptedTask[] {
  if (!Array.isArray(records)) return [];
  return records.filter(
    (entry): entry is DecryptedTask =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { id?: unknown }).id === 'string' &&
      !(entry as { archived?: unknown }).archived,
  );
}

/**
 * The Tasks list: once the Vault is unlocked, pull the Tasks blob and decrypt
 * it on-device with the Master Key. Tap a task to toggle it done, long-press
 * to delete it, or add one by title; pull down to re-read edits made on
 * another device. Each edit is pushed to the server as Ciphertext straight
 * away; a failed push puts the list back and offers a retry (ADR 0107).
 */
export function TasksScreen(): React.JSX.Element {
  const { logout } = useAuth();
  const { lock } = useVaultSession();
  const theme = useTheme();
  const {
    snapshot,
    loading,
    refreshing,
    loadError,
    writing,
    writeError,
    reload,
    apply,
    retry,
  } = useVaultBlob(VaultBlobType.Tasks);

  const [newTitle, setNewTitle] = useState('');
  // The title of an add whose push failed, so that a successful retry of it
  // clears the field exactly as a successful Add does — otherwise the title
  // left behind invites the same task being added twice. Any other edit
  // replaces the failed one `retry` would resend, so it clears this too.
  const failedAddTitleRef = useRef<string | null>(null);

  const tasks = useMemo(
    () => toVisibleTasks(snapshot?.envelope.records),
    [snapshot],
  );

  const toggleTask = useCallback(
    (task: DecryptedTask): void => {
      const now = new Date().toISOString();
      failedAddTitleRef.current = null;
      void apply((envelope) =>
        putVaultRecord(envelope, {
          ...task,
          status: task.status === 'done' ? 'pending' : 'done',
          updatedAt: now,
        }),
      );
    },
    [apply],
  );

  const confirmDelete = useCallback(
    (task: DecryptedTask): void => {
      Alert.alert('Delete task?', task.title ?? 'Untitled task', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const now = new Date().toISOString();
            failedAddTitleRef.current = null;
            void apply((envelope) => deleteVaultRecord(envelope, task.id, now));
          },
        },
      ]);
    },
    [apply],
  );

  const addTask = useCallback(async (): Promise<void> => {
    const title = newTitle.trim();
    if (!title) return;
    const task: Task = {
      id: newRecordId(),
      title,
      status: 'pending',
      priority: 'medium',
      archived: false,
      createdAt: new Date().toISOString(),
    };
    // The title stays in the field until the task is on the server, so a
    // failed push never loses what was typed.
    if (await apply((envelope) => putVaultRecord(envelope, task))) {
      failedAddTitleRef.current = null;
      setNewTitle('');
    } else {
      failedAddTitleRef.current = title;
    }
  }, [apply, newTitle]);

  const retryFailedEdit = useCallback(async (): Promise<void> => {
    const addedTitle = failedAddTitleRef.current;
    if (!(await retry())) return;
    failedAddTitleRef.current = null;
    if (addedTitle !== null) {
      setNewTitle((current) => (current.trim() === addedTitle ? '' : current));
    }
  }, [retry]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<DecryptedTask>): React.JSX.Element => {
      const done = item.status === 'done';
      const meta = [item.status, item.priority].filter(Boolean).join(' · ');
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: done, disabled: writing }}
          accessibilityHint="Toggles done. Long-press to delete."
          disabled={writing}
          onPress={() => toggleTask(item)}
          onLongPress={() => confirmDelete(item)}
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
          <ThemedText
            variant="body"
            style={done ? styles.doneTitle : undefined}
          >
            {item.title ?? 'Untitled task'}
          </ThemedText>
          {meta.length > 0 && <ThemedText variant="caption">{meta}</ThemedText>}
        </Pressable>
      );
    },
    [theme, writing, toggleTask, confirmDelete],
  );

  return (
    <ScreenContainer>
      <View style={[styles.header, { marginBottom: theme.spacing.md }]}>
        <ThemedText variant="titleLg">Tasks</ThemedText>
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
      ) : loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
          <ThemedText variant="body" color="errorText">
            {describeLoadError(loadError)}
          </ThemedText>
          <ThemedButton
            label="Try again"
            variant="outline"
            onPress={() => void reload()}
          />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.addRow,
              { gap: theme.spacing.sm, marginBottom: theme.spacing.md },
            ]}
          >
            <ThemedInput
              placeholder="Add a task"
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={() => void addTask()}
              returnKeyType="done"
              editable={!writing}
              containerStyle={styles.addInput}
            />
            <ThemedButton
              label="Add"
              onPress={() => void addTask()}
              disabled={writing || newTitle.trim().length === 0}
            />
          </View>

          {writeError != null && (
            <View
              accessibilityRole="alert"
              style={[
                styles.writeError,
                {
                  borderColor: theme.colors.errorEdge,
                  borderRadius: theme.radii.md,
                  padding: theme.spacing.md,
                  gap: theme.spacing.sm,
                  marginBottom: theme.spacing.md,
                },
              ]}
            >
              <ThemedText variant="body" color="errorText">
                {WRITE_ERROR_MESSAGES[writeError]}
              </ThemedText>
              <ThemedButton
                label={writeError === 'conflict' ? 'Reload' : 'Try again'}
                variant="outline"
                onPress={() =>
                  void (writeError === 'conflict'
                    ? reload()
                    : retryFailedEdit())
                }
              />
            </View>
          )}

          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={() => void reload()}
            ListEmptyComponent={
              <View style={styles.centered}>
                <ThemedText variant="body">No tasks yet.</ThemedText>
                <ThemedText
                  variant="caption"
                  style={{ marginTop: theme.spacing.xs }}
                >
                  Add one above, or on the web.
                </ThemedText>
              </View>
            }
            contentContainerStyle={[
              styles.listContent,
              { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
            ]}
            showsVerticalScrollIndicator={false}
          />
        </>
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
  },
  writeError: {
    borderWidth: 1,
  },
  card: {
    borderWidth: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
