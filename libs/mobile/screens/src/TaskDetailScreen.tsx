import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  usePendingVaultEdit,
  useVaultBlob,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import {
  deleteVaultRecord,
  putVaultRecord,
  transitionTaskStatus,
  type Task,
  type TaskContext,
  type TaskPriority,
  type TaskStatus,
} from '@myorganizer/vault-core/portable';
import {
  Button,
  Chip,
  ConfirmSheet,
  EmptyState,
  InlineNotice,
  OfflineBanner,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  useTheme,
} from '@myorganizer/mobile/ui';
import { TASKS_ROUTES, type TasksStackParamList } from './tasksStack';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { findVisibleTask, taskStatus as readTaskStatus } from './taskModel';
import { describeVaultLoadError } from './vaultLoadError';

const PRIORITY_SEGMENTS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const satisfies readonly { value: TaskPriority; label: string }[];

const STATUS_CHIPS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
] as const satisfies readonly { value: TaskStatus; label: string }[];

const CONTEXT_CHIPS = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
] as const satisfies readonly { value: TaskContext; label: string }[];

/** What this screen is editing before the next commit — seeded from the
 * Task once per id, so a background reload never clobbers what the User is
 * mid-typing into the same field. */
interface Draft {
  title: string;
  description: string;
  dueDate: string;
  estimate: string;
}

function draftFrom(task: {
  title?: string;
  description?: string;
  dueDate?: string;
  estimatedMinutes?: number;
}): Draft {
  return {
    title: task.title ?? '',
    description: task.description ?? '',
    dueDate: task.dueDate ?? '',
    estimate:
      task.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
  };
}

/**
 * One Task's detail: every field saves as it changes — a text field on blur
 * or Return, never per keystroke, and every chip immediately, since a chip
 * choice is not something a User is still typing. Delete lives only here,
 * behind a ConfirmSheet that offers "Archive instead" — Archive keeps the
 * Task's Ciphertext and lets the web bring it back; Delete does not.
 */
export function TaskDetailScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<TasksStackParamList, typeof TASKS_ROUTES.detail>
    >();
  const { taskId } =
    useRoute<RouteProp<TasksStackParamList, typeof TASKS_ROUTES.detail>>()
      .params;

  const {
    snapshot,
    loading,
    loadError,
    writing,
    writeError,
    reload,
    apply,
    retry,
  } = useVaultBlob(VaultBlobType.Tasks);

  const task = useMemo(
    () => findVisibleTask(snapshot?.envelope.records, taskId),
    [snapshot, taskId],
  );

  const { pendingId, revertedId, push, reloadAfterConflict, retryFailedEdit } =
    usePendingVaultEdit(apply, retry, reload);

  // Seeded once per Task id: re-seeding on every snapshot would overwrite
  // whatever the User has typed and not yet blurred away from every time a
  // background reload lands.
  const [seededId, setSeededId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    title: '',
    description: '',
    dueDate: '',
    estimate: '',
  });
  if (task !== null && task.id !== seededId) {
    setSeededId(task.id);
    setDraft(draftFrom(task));
  }

  const [deleteVisible, setDeleteVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: task?.title ?? 'Task' });
  }, [navigation, task?.title]);

  const commitTask = useCallback(
    (next: Task): void => {
      void push(next.id, (envelope) => putVaultRecord(envelope, next));
    },
    [push],
  );

  const commitTitle = useCallback((): void => {
    if (task === null) return;
    const trimmed = draft.title.trim();
    if (trimmed.length === 0 || trimmed === (task.title ?? '')) {
      setDraft((current) => ({ ...current, title: task.title ?? '' }));
      return;
    }
    commitTask({
      ...(task as Task),
      title: trimmed,
      updatedAt: new Date().toISOString(),
    });
  }, [task, draft.title, commitTask]);

  const commitDescription = useCallback((): void => {
    if (task === null) return;
    const trimmed = draft.description.trim();
    if (trimmed === (task.description ?? '')) return;
    const next: Task = {
      ...(task as Task),
      updatedAt: new Date().toISOString(),
    };
    if (trimmed.length > 0) next.description = trimmed;
    else delete next.description;
    commitTask(next);
  }, [task, draft.description, commitTask]);

  const commitDueDateText = useCallback((): void => {
    if (task === null) return;
    const trimmed = draft.dueDate.trim();
    if (trimmed === (task.dueDate ?? '')) return;
    const next: Task = {
      ...(task as Task),
      updatedAt: new Date().toISOString(),
    };
    if (trimmed.length > 0) next.dueDate = trimmed;
    else delete next.dueDate;
    commitTask(next);
  }, [task, draft.dueDate, commitTask]);

  const commitEstimate = useCallback((): void => {
    if (task === null) return;
    const trimmed = draft.estimate.trim();
    const parsed = trimmed.length > 0 ? Number(trimmed) : NaN;
    const nextValue =
      trimmed.length > 0 && Number.isFinite(parsed) && parsed >= 0
        ? parsed
        : undefined;
    if ((nextValue ?? null) === (task.estimatedMinutes ?? null)) {
      setDraft((current) => ({
        ...current,
        estimate:
          task.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
      }));
      return;
    }
    const next: Task = {
      ...(task as Task),
      updatedAt: new Date().toISOString(),
    };
    if (nextValue != null) next.estimatedMinutes = nextValue;
    else delete next.estimatedMinutes;
    commitTask(next);
  }, [task, draft.estimate, commitTask]);

  const setPriority = useCallback(
    (value: TaskPriority): void => {
      if (task === null || value === task.priority) return;
      commitTask({
        ...(task as Task),
        priority: value,
        updatedAt: new Date().toISOString(),
      });
    },
    [task, commitTask],
  );

  const toggleContext = useCallback(
    (value: TaskContext): void => {
      if (task === null) return;
      const next: Task = {
        ...(task as Task),
        updatedAt: new Date().toISOString(),
      };
      if (task.context === value) delete next.context;
      else next.context = value;
      commitTask(next);
    },
    [task, commitTask],
  );

  const setStatus = useCallback(
    (value: TaskStatus): void => {
      if (task === null || value === readTaskStatus(task)) return;
      const now = new Date().toISOString();
      commitTask(transitionTaskStatus(task as Task, value, now));
    },
    [task, commitTask],
  );

  const confirmDelete = useCallback((): void => {
    if (task === null) return;
    const now = new Date().toISOString();
    void push(task.id, (envelope) =>
      deleteVaultRecord(envelope, task.id, now),
    ).then((confirmed) => {
      if (confirmed) {
        setDeleteVisible(false);
        navigation.goBack();
      }
    });
  }, [task, push, navigation]);

  const archiveInstead = useCallback((): void => {
    if (task === null) return;
    const now = new Date().toISOString();
    void push(task.id, (envelope) =>
      putVaultRecord(envelope, {
        ...(task as Task),
        archived: true,
        updatedAt: now,
      }),
    ).then((confirmed) => {
      if (confirmed) {
        setDeleteVisible(false);
        navigation.goBack();
      }
    });
  }, [task, push, navigation]);

  const cancelDelete = useCallback((): void => {
    if (pendingId !== null) return;
    setDeleteVisible(false);
  }, [pendingId]);

  const notice = writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
  const reverted =
    task !== null && revertedId === task.id && writeError != null;

  return (
    <Screen edges={STACK_SCREEN_EDGES}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
          <OfflineBanner />
          <InlineNotice
            tone="destructive"
            message={describeVaultLoadError(loadError, 'this task')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : task === null ? (
        <View style={styles.centered}>
          <EmptyState
            icon="tasks"
            title="Task not found"
            description="It may have been deleted on another device."
          />
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { gap: theme.spacing.lg, padding: theme.spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <OfflineBanner />

          {reverted && notice != null && (
            <InlineNotice
              tone="destructive"
              message={notice.message}
              actionLabel={notice.action}
              onAction={() =>
                void (writeError === 'conflict'
                  ? reloadAfterConflict()
                  : retryFailedEdit())
              }
            />
          )}

          {task.closedAt != null && (
            <Text variant="caption" color="mutedForeground">
              Closed {task.closedAt.slice(0, 10)}
            </Text>
          )}

          <TextField
            label="Title"
            value={draft.title}
            onChangeText={(value) =>
              setDraft((current) => ({ ...current, title: value }))
            }
            onBlur={commitTitle}
            onSubmitEditing={commitTitle}
            returnKeyType="done"
            editable={!writing}
          />

          <TextField
            label="Description"
            value={draft.description}
            onChangeText={(value) =>
              setDraft((current) => ({ ...current, description: value }))
            }
            onBlur={commitDescription}
            multiline
            editable={!writing}
          />

          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="labelCaps" color="mutedForeground">
              Priority
            </Text>
            <SegmentedControl
              segments={PRIORITY_SEGMENTS}
              value={task.priority ?? 'medium'}
              onChange={setPriority}
              accessibilityLabel="Priority"
            />
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="labelCaps" color="mutedForeground">
              Status
            </Text>
            <View style={[styles.chipRow, { gap: theme.spacing.xs }]}>
              {STATUS_CHIPS.map((entry) => (
                <Chip
                  key={entry.value}
                  label={entry.label}
                  selected={readTaskStatus(task) === entry.value}
                  onPress={() => setStatus(entry.value)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="labelCaps" color="mutedForeground">
              Context
            </Text>
            <View style={[styles.chipRow, { gap: theme.spacing.xs }]}>
              {CONTEXT_CHIPS.map((entry) => (
                <Chip
                  key={entry.value}
                  label={entry.label}
                  selected={task.context === entry.value}
                  onPress={() => toggleContext(entry.value)}
                />
              ))}
            </View>
          </View>

          <TextField
            label="Due date"
            placeholder="YYYY-MM-DD"
            value={draft.dueDate}
            onChangeText={(value) =>
              setDraft((current) => ({ ...current, dueDate: value }))
            }
            onBlur={commitDueDateText}
            onSubmitEditing={commitDueDateText}
            returnKeyType="done"
            editable={!writing}
          />

          <TextField
            label="Estimate (minutes)"
            keyboardType="number-pad"
            value={draft.estimate}
            onChangeText={(value) =>
              setDraft((current) => ({ ...current, estimate: value }))
            }
            onBlur={commitEstimate}
            onSubmitEditing={commitEstimate}
            returnKeyType="done"
            editable={!writing}
          />

          <Button
            label="Delete task"
            variant="destructive"
            onPress={() => setDeleteVisible(true)}
          />
        </ScrollView>
      )}

      <ConfirmSheet
        visible={deleteVisible}
        title="Delete task?"
        message={`Delete "${task?.title ?? 'Untitled task'}"? This can't be undone.`}
        confirmLabel="Delete"
        destructive
        secondaryLabel="Archive instead"
        onSecondary={archiveInstead}
        busy={task !== null && pendingId === task.id}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
