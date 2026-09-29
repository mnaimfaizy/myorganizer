import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@myorganizer/mobile/feat-auth';
import {
  newRecordId,
  usePendingVaultEdit,
  useVaultBlob,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  putVaultRecord,
  transitionTaskStatus,
  type Task,
  type TaskContext,
  type TaskPriority,
} from '@myorganizer/vault-core/portable';
import {
  Button,
  Checkbox,
  Chip,
  EmptyState,
  IconButton,
  InlineNotice,
  ListRow,
  ListSection,
  OfflineBanner,
  Screen,
  SegmentedControl,
  Snackbar,
  StatusPill,
  Switch,
  TextField,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import { TaskPriorityMarker } from './TaskPriorityMarker';
import {
  localDateOnlyString,
  selectClosedTaskSections,
  selectOpenTaskGroups,
  type DecryptedTask,
  type TaskContextFilter,
} from './taskModel';
import { TASKS_ROUTES, type TasksStackParamList } from './tasksStack';
import { TAB_SCREEN_EDGES, TabScreenHeader } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';
import { useRememberedScroll } from './useRememberedScroll';

/** Which due date, if any, a captured task starts with. */
type DueChoice = 'none' | 'today' | 'tomorrow' | 'custom';

const CONTEXT_SEGMENTS = [
  { value: 'all', label: 'All' },
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
] as const satisfies readonly { value: TaskContextFilter; label: string }[];

const PRIORITY_CHIPS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const satisfies readonly { value: TaskPriority; label: string }[];

const CONTEXT_CHIPS = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
] as const satisfies readonly { value: TaskContext; label: string }[];

/** What just happened, said the way the Snackbar's Undo puts it back. */
interface PendingUndo {
  message: string;
  /** The Task exactly as it stood before the action that can be undone. */
  task: DecryptedTask;
}

/**
 * The Tasks tab: quick capture, the open Tasks grouped Overdue / Today /
 * Upcoming / No date, and — once "Show done" is on — Done then Cancelled.
 *
 * A tap or a swipe right marks a Task done; a swipe left archives it (web
 * only shows Archived Tasks again, per #915). Both offer Undo, which puts
 * back the exact Task this screen held before the action — closed status and
 * all — rather than a fixed status. Unticking a Done or Cancelled row moves it
 * straight to pending; that reversal needs no Undo of its own.
 *
 * Every edit is pushed to the server as Ciphertext straight away; a failed
 * push puts the row back and offers a retry (ADR 0107).
 */
export function TasksScreen(): React.JSX.Element {
  const { logout } = useAuth();
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<TasksStackParamList>>();
  const rememberedScroll = useRememberedScroll('Tasks');
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

  const [contextFilter, setContextFilter] = useState<TaskContextFilter>('all');
  const [showDone, setShowDone] = useState(false);

  const openGroups = useMemo(
    () =>
      selectOpenTaskGroups(
        snapshot?.envelope.records,
        contextFilter,
        new Date(),
      ),
    [snapshot, contextFilter],
  );
  const closedSections = useMemo(
    () =>
      showDone
        ? selectClosedTaskSections(snapshot?.envelope.records, contextFilter)
        : [],
    [snapshot, contextFilter, showDone],
  );

  const {
    pendingId: pendingTaskId,
    revertedId: revertedTaskId,
    push,
    reloadAfterConflict,
    retryFailedEdit,
  } = usePendingVaultEdit(apply, retry, reload);

  // Quick capture's own draft. Reset after every successful capture, not
  // just the title, so a captured "Tomorrow, High, Work" task is not
  // followed by an identical one by accident.
  const [title, setTitle] = useState('');
  const [dueChoice, setDueChoice] = useState<DueChoice>('none');
  const [customDate, setCustomDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [context, setContext] = useState<TaskContext | undefined>(undefined);

  const [undo, setUndo] = useState<PendingUndo | null>(null);

  const resetComposer = useCallback((): void => {
    setTitle('');
    setDueChoice('none');
    setCustomDate('');
    setPriority('medium');
    setContext(undefined);
  }, []);

  const capture = useCallback(async (): Promise<void> => {
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    const now = new Date().toISOString();
    const dueDate =
      dueChoice === 'today'
        ? localDateOnlyString(new Date())
        : dueChoice === 'tomorrow'
          ? localDateOnlyString(new Date(Date.now() + 24 * 60 * 60 * 1000))
          : dueChoice === 'custom' && customDate.trim().length > 0
            ? customDate.trim()
            : undefined;
    const task: Task = {
      id: newRecordId(),
      title: trimmed,
      status: 'pending',
      priority,
      archived: false,
      createdAt: now,
      ...(dueDate != null ? { dueDate } : {}),
      ...(context != null ? { context } : {}),
    };
    if (await push(task.id, (envelope) => putVaultRecord(envelope, task))) {
      resetComposer();
    }
  }, [title, dueChoice, customDate, priority, context, push, resetComposer]);

  const markDone = useCallback(
    (task: DecryptedTask): void => {
      const now = new Date().toISOString();
      void push(task.id, (envelope) =>
        putVaultRecord(
          envelope,
          transitionTaskStatus(task as Task, 'done', now),
        ),
      ).then((confirmed) => {
        if (confirmed) setUndo({ message: 'Task done · Undo', task });
      });
    },
    [push],
  );

  const reopenToPending = useCallback(
    (task: DecryptedTask): void => {
      const now = new Date().toISOString();
      void push(task.id, (envelope) =>
        putVaultRecord(
          envelope,
          transitionTaskStatus(task as Task, 'pending', now),
        ),
      );
    },
    [push],
  );

  const archiveTask = useCallback(
    (task: DecryptedTask): void => {
      const now = new Date().toISOString();
      void push(task.id, (envelope) =>
        putVaultRecord(envelope, {
          ...(task as Task),
          archived: true,
          updatedAt: now,
        }),
      ).then((confirmed) => {
        if (confirmed) setUndo({ message: 'Archived · Undo', task });
      });
    },
    [push],
  );

  const undoLastAction = useCallback((): void => {
    if (undo === null) return;
    const { task } = undo;
    setUndo(null);
    // Puts back the captured Task exactly as it stood before — status,
    // closedAt, and archived included — so Undo restores the exact earlier
    // status rather than a fixed one. Only `updatedAt` moves, because the
    // restore is a real edit of its own and not a silent no-op.
    void push(task.id, (envelope) =>
      putVaultRecord(envelope, {
        ...(task as Task),
        updatedAt: new Date().toISOString(),
      }),
    );
  }, [undo, push]);

  const openDetail = useCallback(
    (taskId: string): void => {
      navigation.navigate(TASKS_ROUTES.detail, { taskId });
    },
    [navigation],
  );

  const rowState = (id: string): ListRowState =>
    pendingTaskId === id
      ? 'unconfirmed'
      : revertedTaskId === id && writeError != null
        ? 'reverted'
        : 'normal';

  const describeMeta = (task: DecryptedTask): string | undefined => {
    const parts: string[] = [];
    if (task.context != null) {
      parts.push(task.context === 'work' ? 'Work' : 'Personal');
    }
    if (task.dueDate != null) parts.push(`Due ${task.dueDate}`);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  // Done and Cancelled rows show their close date instead of a due date —
  // this is what lets a Task closed on the web show its close date here.
  // A Task closed before #915 added `closedAt` carries none; the row falls
  // back to context alone rather than printing a missing date.
  const describeClosedMeta = (task: DecryptedTask): string | undefined => {
    const parts: string[] = [];
    if (task.context != null) {
      parts.push(task.context === 'work' ? 'Work' : 'Personal');
    }
    if (task.closedAt != null)
      parts.push(`Closed ${task.closedAt.slice(0, 10)}`);
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  const renderOpenTask = (task: DecryptedTask): React.JSX.Element => {
    const notice =
      writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
    const blocked = task.status === 'blocked';
    const taskTitle = task.title ?? 'Untitled task';

    return (
      <ListRow
        key={task.id}
        title={taskTitle}
        subtitle={describeMeta(task)}
        checked={false}
        accessibilityLabel={blocked ? `${taskTitle}, blocked` : taskTitle}
        onPress={writing ? undefined : () => markDone(task)}
        leading={
          <View style={[styles.leadingRow, { gap: theme.spacing.sm }]}>
            <TaskPriorityMarker priority={task.priority} />
            <Checkbox
              checked={false}
              disabled={writing}
              accessibilityLabel={taskTitle}
              onChange={() => markDone(task)}
            />
          </View>
        }
        trailing={
          <View style={[styles.trailingRow, { gap: theme.spacing.xs }]}>
            {blocked && <StatusPill label="Blocked" tone="warning" />}
            <IconButton
              icon="chevronRight"
              accessibilityLabel="Task details"
              onPress={() => openDetail(task.id)}
            />
          </View>
        }
        innerActions={[
          {
            id: 'details',
            label: 'Task details',
            onPress: () => openDetail(task.id),
          },
        ]}
        rightActions={[
          {
            id: 'done',
            label: 'Done',
            icon: 'check',
            tone: 'neutral',
            onPress: () => markDone(task),
          },
        ]}
        leftActions={[
          {
            id: 'archive',
            label: 'Archive',
            icon: 'archive',
            tone: 'neutral',
            onPress: () => archiveTask(task),
          },
        ]}
        state={rowState(task.id)}
        revertedReason={notice?.message}
        retryLabel={notice?.action}
        onRetry={
          writeError === 'conflict' ? reloadAfterConflict : retryFailedEdit
        }
        style={[styles.row, { borderRadius: theme.radii.md }]}
      />
    );
  };

  const renderClosedTask = (task: DecryptedTask): React.JSX.Element => {
    const notice =
      writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
    const taskTitle = task.title ?? 'Untitled task';

    return (
      <ListRow
        key={task.id}
        title={taskTitle}
        subtitle={describeClosedMeta(task)}
        checked
        accessibilityLabel={taskTitle}
        onPress={writing ? undefined : () => reopenToPending(task)}
        leading={
          <Checkbox
            checked
            disabled={writing}
            accessibilityLabel={taskTitle}
            onChange={() => reopenToPending(task)}
          />
        }
        trailing={
          <IconButton
            icon="chevronRight"
            accessibilityLabel="Task details"
            onPress={() => openDetail(task.id)}
          />
        }
        innerActions={[
          {
            id: 'details',
            label: 'Task details',
            onPress: () => openDetail(task.id),
          },
        ]}
        state={rowState(task.id)}
        revertedReason={notice?.message}
        retryLabel={notice?.action}
        onRetry={
          writeError === 'conflict' ? reloadAfterConflict : retryFailedEdit
        }
        style={[styles.row, { borderRadius: theme.radii.md }]}
      />
    );
  };

  const nothingToShow = openGroups.length === 0 && closedSections.length === 0;

  return (
    <Screen edges={TAB_SCREEN_EDGES}>
      <TabScreenHeader title="Tasks" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
          <OfflineBanner />
          <InlineNotice
            tone="destructive"
            message={describeVaultLoadError(loadError, 'your tasks')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : (
        <>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              {
                gap: theme.spacing.md,
                padding: theme.spacing.md,
                paddingBottom: theme.spacing.xl,
              },
            ]}
            showsVerticalScrollIndicator={false}
            {...rememberedScroll}
          >
            <OfflineBanner />

            {/* Signing out lives here until the Account tab is built, because
                nothing else in the shell offers it. */}
            <Button
              label="Sign out"
              variant="ghost"
              onPress={() => void logout()}
              style={styles.signOut}
            />

            <SegmentedControl
              segments={CONTEXT_SEGMENTS}
              value={contextFilter}
              onChange={setContextFilter}
              accessibilityLabel="Filter tasks by context"
            />

            <Switch
              value={showDone}
              onValueChange={setShowDone}
              label="Show done"
            />

            {writeError != null && revertedTaskId != null && (
              <InlineNotice
                tone="destructive"
                message={VAULT_WRITE_ERROR_COPY[writeError].message}
                actionLabel={VAULT_WRITE_ERROR_COPY[writeError].action}
                onAction={() =>
                  void (writeError === 'conflict'
                    ? reloadAfterConflict()
                    : retryFailedEdit())
                }
              />
            )}

            {nothingToShow && (
              <EmptyState
                icon="tasks"
                title="No tasks yet"
                description="Capture one below, or on the web."
              />
            )}

            {openGroups.map((group) => (
              <ListSection
                key={group.key}
                title={group.label}
                meta={`${group.tasks.length}`}
                style={{ gap: theme.spacing.sm }}
              >
                {group.tasks.map(renderOpenTask)}
              </ListSection>
            ))}

            {showDone &&
              closedSections.map((section) => (
                <ListSection
                  key={section.key}
                  title={section.label}
                  meta={`${section.tasks.length}`}
                  style={{ gap: theme.spacing.sm }}
                >
                  {section.tasks.map(renderClosedTask)}
                </ListSection>
              ))}
          </ScrollView>

          {/* Quick capture: docked above the tab bar, not part of the scroll
              content, so it stays reachable while browsing any group. */}
          <View
            style={[
              styles.composer,
              {
                borderTopColor: theme.colors.border,
                backgroundColor: theme.colors.background,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              },
            ]}
          >
            <View style={[styles.chipRow, { gap: theme.spacing.xs }]}>
              <Chip
                label="Today"
                selected={dueChoice === 'today'}
                onPress={() =>
                  setDueChoice((current) =>
                    current === 'today' ? 'none' : 'today',
                  )
                }
              />
              <Chip
                label="Tomorrow"
                selected={dueChoice === 'tomorrow'}
                onPress={() =>
                  setDueChoice((current) =>
                    current === 'tomorrow' ? 'none' : 'tomorrow',
                  )
                }
              />
              <Chip
                label="Date"
                selected={dueChoice === 'custom'}
                onPress={() =>
                  setDueChoice((current) =>
                    current === 'custom' ? 'none' : 'custom',
                  )
                }
              />
              {PRIORITY_CHIPS.map((entry) => (
                <Chip
                  key={entry.value}
                  label={entry.label}
                  selected={priority === entry.value}
                  onPress={() => setPriority(entry.value)}
                />
              ))}
              {CONTEXT_CHIPS.map((entry) => (
                <Chip
                  key={entry.value}
                  label={entry.label}
                  selected={context === entry.value}
                  onPress={() =>
                    setContext((current) =>
                      current === entry.value ? undefined : entry.value,
                    )
                  }
                />
              ))}
            </View>
            {dueChoice === 'custom' && (
              <TextField
                placeholder="YYYY-MM-DD"
                value={customDate}
                onChangeText={setCustomDate}
                editable={!writing}
                accessibilityLabel="Due date"
              />
            )}
            <View style={[styles.captureRow, { gap: theme.spacing.sm }]}>
              <TextField
                placeholder="Capture a task"
                value={title}
                onChangeText={setTitle}
                onSubmitEditing={() => void capture()}
                returnKeyType="done"
                editable={!writing}
                accessibilityLabel="Capture a task"
                containerStyle={styles.captureInput}
              />
              <Button
                label="Add"
                onPress={() => void capture()}
                disabled={writing || title.trim().length === 0}
              />
            </View>
          </View>
        </>
      )}

      <Snackbar
        visible={undo !== null}
        message={undo?.message ?? ''}
        actionLabel="Undo"
        onAction={undoLastAction}
        onDismiss={() => setUndo(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  row: {
    overflow: 'hidden',
  },
  leadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trailingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signOut: {
    alignSelf: 'flex-end',
  },
  composer: {
    borderTopWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  captureInput: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
