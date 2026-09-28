import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import {
  isNetworkError,
  newRecordId,
  useVaultBlob,
  type VaultBlobWriteErrorKind,
} from '@myorganizer/mobile/feat-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  deleteVaultRecord,
  putVaultRecord,
  type Task,
} from '@myorganizer/vault-core/portable';
import {
  Button,
  Checkbox,
  ConfirmSheet,
  EmptyState,
  InlineNotice,
  ListRow,
  OfflineBanner,
  Screen,
  TextField,
  useTheme,
} from '@myorganizer/mobile/ui';
import { TabScreenHeader } from './TabScreenHeader';

/**
 * A decrypted task as this screen reads it. The payload is decrypted JSON, so
 * every field but `id` is a claim; the whole entry is kept and spread back on
 * edit so fields this screen does not know survive the round trip.
 */
type DecryptedTask = Partial<Task> & { id: string };

/**
 * The tab bar owns the bottom inset, so a screen inside a tab does not take it
 * again — insetting twice leaves a visible gap above the bar.
 */
const SCREEN_EDGES = ['top', 'left', 'right'] as const;

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
 * it on-device with the Master Key. Tick a task to mark it done, swipe it to
 * delete — which is also an accessibility action on the row, so the delete is
 * reachable without a drag — or add one by title; pull down to re-read edits
 * made on another device. Each edit is pushed to the server as Ciphertext
 * straight away; a failed push puts the list back and offers a retry
 * (ADR 0107).
 */
export function TasksScreen(): React.JSX.Element {
  const { logout } = useAuth();
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
  const [pendingDelete, setPendingDelete] = useState<DecryptedTask | null>(
    null,
  );
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

  const deleteTask = useCallback(
    (task: DecryptedTask): void => {
      const now = new Date().toISOString();
      failedAddTitleRef.current = null;
      void apply((envelope) => deleteVaultRecord(envelope, task.id, now));
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
      const title = item.title ?? 'Untitled task';
      return (
        <ListRow
          title={title}
          subtitle={meta.length > 0 ? meta : undefined}
          leading={
            <Checkbox
              checked={done}
              disabled={writing}
              accessibilityLabel={title}
              onChange={() => toggleTask(item)}
            />
          }
          rightActions={[
            {
              id: 'delete',
              label: 'Delete',
              icon: 'close',
              tone: 'destructive',
              onPress: () => setPendingDelete(item),
            },
          ]}
          style={{ borderRadius: theme.radii.md, overflow: 'hidden' }}
        />
      );
    },
    [theme, writing, toggleTask],
  );

  return (
    <Screen edges={SCREEN_EDGES}>
      <TabScreenHeader title="Tasks" />
      <OfflineBanner />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
          <InlineNotice
            tone="destructive"
            message={describeLoadError(loadError)}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.addRow,
              {
                gap: theme.spacing.sm,
                marginTop: theme.spacing.sm,
                marginBottom: theme.spacing.md,
              },
            ]}
          >
            <TextField
              placeholder="Add a task"
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={() => void addTask()}
              returnKeyType="done"
              editable={!writing}
              accessibilityLabel="Add a task"
              containerStyle={styles.addInput}
            />
            <Button
              label="Add"
              onPress={() => void addTask()}
              disabled={writing || newTitle.trim().length === 0}
            />
          </View>

          {writeError != null && (
            <InlineNotice
              tone="destructive"
              message={WRITE_ERROR_MESSAGES[writeError]}
              actionLabel={writeError === 'conflict' ? 'Reload' : 'Try again'}
              onAction={() =>
                void (writeError === 'conflict' ? reload() : retryFailedEdit())
              }
              style={{ marginBottom: theme.spacing.md }}
            />
          )}

          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={() => void reload()}
            ListEmptyComponent={
              <EmptyState
                icon="tasks"
                title="No tasks yet"
                description="Add one above, or on the web."
              />
            }
            contentContainerStyle={[
              styles.listContent,
              { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
            ]}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {/* Signing out lives here until the Account tab is built, because
          nothing else in the shell offers it. Lock is the header's trailing
          action on both platforms and is not repeated. */}
      <Button
        label="Sign out"
        variant="ghost"
        onPress={() => void logout()}
        style={styles.signOut}
      />

      <ConfirmSheet
        visible={pendingDelete !== null}
        title="Delete task?"
        message={pendingDelete?.title ?? 'Untitled task'}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDelete !== null) deleteTask(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addInput: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  signOut: {
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
