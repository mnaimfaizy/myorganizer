import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  type VaultBlobEdit,
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
  haptics,
  InlineNotice,
  OfflineBanner,
  SavingNote,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  useTheme,
} from '@myorganizer/mobile/ui';
import { DateField } from './DateField';
import { TASKS_ROUTES, type TasksStackParamList } from './tasksStack';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import {
  describeCreated,
  findVisibleTask,
  labelledValues,
  TASK_CONTEXT_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  taskStatus as readTaskStatus,
  type DecryptedTask,
} from './taskModel';
import { describeVaultLoadError } from './vaultLoadError';

/** Every field the detail screen saves on its own. */
type TaskField =
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'context'
  | 'dueDate'
  | 'estimate';

/** The Context selector's choices: no context, or one of the two. */
type ContextChoice = 'none' | TaskContext;

const CONTEXT_CHOICE_LABEL = {
  none: 'None',
  ...TASK_CONTEXT_LABEL,
} as const satisfies Record<ContextChoice, string>;

const STATUS_VALUES = labelledValues(TASK_STATUS_LABEL);

const PRIORITY_SEGMENTS = labelledValues(TASK_PRIORITY_LABEL).map((value) => ({
  value,
  label: TASK_PRIORITY_LABEL[value],
}));

const CONTEXT_SEGMENTS = labelledValues(CONTEXT_CHOICE_LABEL).map((value) => ({
  value,
  label: CONTEXT_CHOICE_LABEL[value],
}));

/** The estimate field's width on the Tasks sheet: a number and its unit. */
const ESTIMATE_FIELD_WIDTH = 180;

/** What this screen is editing before the next commit — seeded from the
 * Task once per id, so a background reload never clobbers what the User is
 * mid-typing into the same field. */
interface Draft {
  title: string;
  description: string;
  estimate: string;
}

function draftFrom(task: DecryptedTask): Draft {
  return {
    title: task.title ?? '',
    description: task.description ?? '',
    estimate:
      task.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
  };
}

/** A section's label, with the field's own "Saving…" at its far end. */
function FieldLabel({
  label,
  saving,
}: {
  label: string;
  saving: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={[styles.labelRow, { gap: theme.spacing.sm }]}>
      <Text variant="bodySm" weight="semibold" color="foreground">
        {label}
      </Text>
      {saving && <SavingNote />}
    </View>
  );
}

/**
 * One Task's detail: every field saves as it changes — a text field on blur
 * or Return, never per keystroke, and every selector immediately, since a
 * choice is not something a User is still typing. Each save is an
 * Unconfirmed Edit on its own field: "Saving…" beside that field's label
 * while it is in flight, and — when it is refused — the last saved copy back
 * in the field with the reason and a retry under it.
 *
 * Delete lives only here, behind a ConfirmSheet that offers "Archive
 * instead" — Archive keeps the Task's Ciphertext and lets the web bring it
 * back; Delete does not.
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
    estimate: '',
  });
  if (task !== null && task.id !== seededId) {
    setSeededId(task.id);
    setDraft(draftFrom(task));
  }

  const [deleteVisible, setDeleteVisible] = useState(false);
  // Which field the latest save came from, so its "Saving…" and its revert
  // note sit beside that field and nowhere else.
  const [editedField, setEditedField] = useState<TaskField | null>(null);

  useLayoutEffect(() => {
    // The sheet draws the bar with its back link and Lock only: the Title
    // field below is where the name is read and changed.
    navigation.setOptions({ title: '' });
  }, [navigation]);

  // One push runs at a time, and `apply` refuses a second one outright. A
  // change made while the last one is still in flight waits here and goes
  // next, rather than being dropped without a word.
  const queued = useRef<{ field: TaskField; edit: VaultBlobEdit }[]>([]);

  const send = useCallback(
    (field: TaskField, edit: VaultBlobEdit): void => {
      setEditedField(field);
      void push(taskId, edit);
    },
    [push, taskId],
  );

  useEffect(() => {
    if (writing) return;
    const next = queued.current.shift();
    if (next !== undefined) send(next.field, next.edit);
  }, [writing, send]);

  /**
   * Saves one change to the Task. The change is applied to the Task as it
   * stands in the copy being edited — not to the one this render captured —
   * so two quick edits to different fields never undo each other.
   */
  const commit = useCallback(
    (field: TaskField, change: (current: Task) => Task): void => {
      if (task === null) return;
      const fallback = task as Task;
      const edit: VaultBlobEdit = (envelope) => {
        const current =
          (findVisibleTask(envelope.records, taskId) as Task | null) ??
          fallback;
        return putVaultRecord(envelope, change(current));
      };
      if (writing) queued.current.push({ field, edit });
      else send(field, edit);
    },
    [task, taskId, writing, send],
  );

  const stamp = (): string => new Date().toISOString();

  const commitTitle = useCallback((): void => {
    if (task === null) return;
    const trimmed = draft.title.trim();
    if (trimmed.length === 0 || trimmed === (task.title ?? '')) {
      setDraft((current) => ({ ...current, title: task.title ?? '' }));
      return;
    }
    commit('title', (current) => ({
      ...current,
      title: trimmed,
      updatedAt: stamp(),
    }));
  }, [task, draft.title, commit]);

  const commitDescription = useCallback((): void => {
    if (task === null) return;
    const trimmed = draft.description.trim();
    if (trimmed === (task.description ?? '')) return;
    commit('description', (current) => {
      const next: Task = { ...current, updatedAt: stamp() };
      if (trimmed.length > 0) next.description = trimmed;
      else delete next.description;
      return next;
    });
  }, [task, draft.description, commit]);

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
    commit('estimate', (current) => {
      const next: Task = { ...current, updatedAt: stamp() };
      if (nextValue != null) next.estimatedMinutes = nextValue;
      else delete next.estimatedMinutes;
      return next;
    });
  }, [task, draft.estimate, commit]);

  const setDueDate = useCallback(
    (value: string | null): void => {
      if (task === null || value === (task.dueDate ?? null)) return;
      commit('dueDate', (current) => {
        const next: Task = { ...current, updatedAt: stamp() };
        if (value != null) next.dueDate = value;
        else delete next.dueDate;
        return next;
      });
    },
    [task, commit],
  );

  const setPriority = useCallback(
    (value: TaskPriority): void => {
      if (task === null || value === (task.priority ?? 'medium')) return;
      commit('priority', (current) => ({
        ...current,
        priority: value,
        updatedAt: stamp(),
      }));
    },
    [task, commit],
  );

  const setContext = useCallback(
    (value: ContextChoice): void => {
      if (task === null || value === (task.context ?? 'none')) return;
      commit('context', (current) => {
        const next: Task = { ...current, updatedAt: stamp() };
        if (value === 'none') delete next.context;
        else next.context = value;
        return next;
      });
    },
    [task, commit],
  );

  const setStatus = useCallback(
    (value: TaskStatus): void => {
      if (task === null || value === readTaskStatus(task)) return;
      // The shared transition decides `closedAt`, exactly as the web does.
      commit('status', (current) =>
        transitionTaskStatus(current, value, stamp()),
      );
    },
    [task, commit],
  );

  const leaveAfter = useCallback(
    (edit: VaultBlobEdit): void => {
      if (task === null) return;
      void push(task.id, edit).then((confirmed) => {
        if (confirmed) {
          setDeleteVisible(false);
          navigation.goBack();
        }
      });
    },
    [task, push, navigation],
  );

  const confirmDelete = useCallback((): void => {
    if (task === null) return;
    leaveAfter((envelope) => deleteVaultRecord(envelope, task.id, stamp()));
  }, [task, leaveAfter]);

  const archive = useCallback((): void => {
    if (task === null) return;
    leaveAfter((envelope) =>
      putVaultRecord(envelope, {
        ...((findVisibleTask(envelope.records, task.id) as Task | null) ??
          (task as Task)),
        archived: true,
        updatedAt: stamp(),
      }),
    );
  }, [task, leaveAfter]);

  const cancelDelete = useCallback((): void => {
    if (pendingId !== null) return;
    setDeleteVisible(false);
  }, [pendingId]);

  const notice = writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
  const reverted =
    task !== null && revertedId === task.id && writeError != null;
  const savingField =
    task !== null && pendingId === task.id ? editedField : null;
  const revertedField = reverted ? editedField : null;

  // A refused save puts the last saved copy back in the field it came from —
  // "Showing the last saved copy" has to be true of the field too — and the
  // revert haptic marks the moment, once.
  const wasReverted = useRef(false);
  useEffect(() => {
    const cameBack = reverted && !wasReverted.current;
    wasReverted.current = reverted;
    if (!cameBack || task === null) return;
    haptics.revert();
    setDraft(draftFrom(task));
  }, [reverted, task]);

  const revertNote = (field: TaskField): React.ReactNode =>
    revertedField === field && notice != null ? (
      <InlineNotice
        tone="warning"
        variant="compact"
        message={notice.message}
        actionLabel={notice.action}
        actionIcon="retry"
        onAction={() =>
          void (writeError === 'conflict'
            ? reloadAfterConflict()
            : retryFailedEdit())
        }
      />
    ) : null;

  const created =
    task === null ? null : describeCreated(task.createdAt, new Date());

  return (
    <Screen edges={STACK_SCREEN_EDGES} noPadding>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View
          style={[
            styles.centered,
            { gap: theme.spacing.md, padding: theme.spacing.md },
          ]}
        >
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
        <>
          <OfflineBanner />
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              {
                gap: theme.spacing.lg,
                paddingTop: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                paddingBottom: theme.spacing.lg,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: theme.spacing.sm }}>
              <TextField
                label="Title"
                labelAccessory={
                  savingField === 'title' ? <SavingNote /> : undefined
                }
                placeholder="e.g. Renew passport"
                value={draft.title}
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, title: value }))
                }
                onBlur={commitTitle}
                onSubmitEditing={commitTitle}
                returnKeyType="done"
              />
              {revertNote('title')}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <TextField
                label="Description"
                labelAccessory={
                  savingField === 'description' ? <SavingNote /> : undefined
                }
                value={draft.description}
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, description: value }))
                }
                onBlur={commitDescription}
                multiline
              />
              {revertNote('description')}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <FieldLabel label="Status" saving={savingField === 'status'} />
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Status"
                style={[styles.chipRow, { gap: theme.spacing.sm }]}
              >
                {STATUS_VALUES.map((value) => (
                  <Chip
                    key={value}
                    label={TASK_STATUS_LABEL[value]}
                    accessibilityRole="radio"
                    selected={readTaskStatus(task) === value}
                    onPress={() => setStatus(value)}
                  />
                ))}
              </View>
              {revertNote('status')}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <FieldLabel
                label="Priority"
                saving={savingField === 'priority'}
              />
              <SegmentedControl
                segments={PRIORITY_SEGMENTS}
                value={task.priority ?? 'medium'}
                onChange={setPriority}
                accessibilityLabel="Priority"
              />
              {revertNote('priority')}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <FieldLabel label="Context" saving={savingField === 'context'} />
              <SegmentedControl
                segments={CONTEXT_SEGMENTS}
                value={task.context ?? 'none'}
                onChange={setContext}
                accessibilityLabel="Context"
              />
              {revertNote('context')}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <DateField
                label="Due date"
                labelAccessory={
                  savingField === 'dueDate' ? <SavingNote /> : undefined
                }
                value={task.dueDate ?? null}
                onChange={setDueDate}
                clearable
                clearLabel="Clear due date"
              />
              {revertNote('dueDate')}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <TextField
                label="Estimate"
                labelAccessory={
                  savingField === 'estimate' ? <SavingNote /> : undefined
                }
                accessibilityLabel="Estimate in minutes"
                suffix="minutes"
                keyboardType="number-pad"
                value={draft.estimate}
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, estimate: value }))
                }
                onBlur={commitEstimate}
                onSubmitEditing={commitEstimate}
                returnKeyType="done"
                containerStyle={styles.estimate}
              />
              {revertNote('estimate')}
            </View>

            <Text variant="caption">
              {created != null
                ? `Created ${created} · Changes save as you make them.`
                : 'Changes save as you make them.'}
            </Text>

            <View style={{ gap: theme.spacing.sm }}>
              <Button
                label="Archive"
                icon="archive"
                variant="secondary"
                onPress={archive}
              />
              <Button
                label="Delete task"
                icon="trash"
                variant="destructive"
                onPress={() => setDeleteVisible(true)}
              />
            </View>
          </ScrollView>
        </>
      )}

      <ConfirmSheet
        visible={deleteVisible}
        title="Delete this task?"
        message="This can’t be undone. Archive keeps it instead."
        confirmLabel="Delete task"
        destructive
        secondaryLabel="Archive instead"
        secondaryIcon="archive"
        onSecondary={archive}
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  estimate: {
    width: ESTIMATE_FIELD_WIDTH,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
