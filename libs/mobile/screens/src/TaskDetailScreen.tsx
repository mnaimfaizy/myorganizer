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
  useUnconfirmedEdit,
  useVaultBlob,
  recoversByReload,
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
import { useBarRuleOnScroll } from './useBarRuleOnScroll';
import {
  describeCreated,
  findVisibleTask,
  labelledValues,
  TASK_CONTEXT_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  taskOnDetail,
  taskRemovalNoticePlace,
  taskRemovalPhase,
  taskStatus as readTaskStatus,
  type DecryptedTask,
  type TaskRemoval,
  type TaskRemovalKind,
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
 * back; Delete does not. Either one that is refused says so where the User
 * pressed it — in the sheet, or beside the buttons — with the way to send it
 * again, and the screen leaves whenever it does reach the server.
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
    refreshing,
    writing,
    writeError,
    reload,
    discard,
    apply,
    retry,
  } = useVaultBlob(VaultBlobType.Tasks);

  const task = useMemo(
    () => findVisibleTask(snapshot?.envelope.records, taskId),
    [snapshot, taskId],
  );

  // The delete or archive the User asked for here and has not given up, with
  // the edit that makes it. It holds the Task as it stood then: `apply` takes
  // the Task out of this screen's copy before the push, and the screen is on
  // show until the push has landed and the pop has run; without it the screen
  // would say "Task not found — deleted on another device" about a delete the
  // User just made (#1085). Only what is drawn reads `shown`. Every save
  // still goes by `task`, so nothing can be written to a Task that is on its
  // way out.
  const [removal, setRemoval] = useState<
    (TaskRemoval & { edit: VaultBlobEdit }) | null
  >(null);
  const shown = taskOnDetail(task, removal?.task ?? null);
  // Read from the copy, not from one push's answer: a retry and a reload that
  // sent a held removal land it just as the first push would have (#1088).
  const removalPhase = taskRemovalPhase(removal, task, {
    busy: writing || refreshing,
    refused: writeError != null,
  });

  const { pendingId, revertedId, push, reloadAfterConflict, retryFailedEdit } =
    useUnconfirmedEdit(apply, retry, reload);

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
  const barRule = useBarRuleOnScroll();

  // One push runs at a time, and `apply` refuses a second one outright. A
  // change made while the last one is still in flight waits here and goes
  // next, rather than being dropped without a word. A delete or archive
  // waits the same way, in `removal`, and goes after every field's change.
  const queued = useRef<{ field: TaskField; edit: VaultBlobEdit }[]>([]);

  const send = useCallback(
    (field: TaskField, edit: VaultBlobEdit): void => {
      setEditedField(field);
      void push(taskId, edit);
    },
    [push, taskId],
  );

  useEffect(() => {
    // A reload is a request too, and `apply` refuses during one.
    if (writing || refreshing) return;
    const next = queued.current.shift();
    if (next !== undefined) {
      send(next.field, next.edit);
      return;
    }
    if (removal !== null && !removal.sent) {
      setRemoval({ ...removal, sent: true });
      void push(taskId, removal.edit);
    }
  }, [writing, refreshing, send, removal, push, taskId]);

  /**
   * Saves one change to the Task. The change is applied to the Task as it
   * stands in the copy being edited — not to the one this render captured —
   * so two quick edits to different fields never undo each other.
   */
  const commit = useCallback(
    (field: TaskField, change: (current: Task) => Task): void => {
      if (task === null) return;
      // The Vault holds one failed edit and the next write lets go of it, so
      // a field changed after a refused delete or archive gives that up. Its
      // notice goes with it: nothing is left that could send it later.
      if (removalPhase === 'refused') setRemoval(null);
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
    [task, taskId, writing, send, removalPhase],
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

  const remove = useCallback(
    (kind: TaskRemovalKind, edit: VaultBlobEdit): void => {
      // Not over one already on its way. Over a refused one it is the User
      // answering again, and the new push lets go of the edit held for it.
      if (task === null || removalPhase === 'sending') return;
      // The failure, if there is one, is this removal's and no field's.
      setEditedField(null);
      // Sent by the effect above, once nothing else is in flight.
      setRemoval({ task, kind, edit, sent: false });
    },
    [task, removalPhase],
  );

  const confirmDelete = useCallback((): void => {
    if (task === null) return;
    remove('delete', (envelope) =>
      deleteVaultRecord(envelope, task.id, stamp()),
    );
  }, [task, remove]);

  const archive = useCallback((): void => {
    if (task === null) return;
    remove('archive', (envelope) =>
      putVaultRecord(envelope, {
        ...((findVisibleTask(envelope.records, task.id) as Task | null) ??
          (task as Task)),
        archived: true,
        updatedAt: stamp(),
      }),
    );
  }, [task, remove]);

  // The removal reached the server — by its first push, a retry, or a reload
  // that sent the held edit — so the screen leaves, once. `removal` stays
  // set: the Task is drawn until the pop finishes.
  const left = useRef(false);
  useEffect(() => {
    if (removalPhase !== 'landed' || left.current) return;
    left.current = true;
    setDeleteVisible(false);
    navigation.goBack();
  }, [removalPhase, navigation]);

  // The Task is back and the Vault holds no edit for the removal. Let go of
  // the Task remembered, or a later delete on another device would make this
  // screen leave instead of showing "not found".
  useEffect(() => {
    if (removalPhase === 'dropped') setRemoval(null);
  }, [removalPhase]);

  /**
   * The User gives a refused removal up: the edit the Vault holds for it is
   * dropped, so no later reload can delete or archive a Task they decided to
   * keep ([ADR 0121](../../../../docs/adr/0121-a-mobile-vault-pull-converges-the-unsent-edit-it-is-handed.md)
   * item 5). Nothing to do in any other phase.
   */
  const giveUpRemoval = useCallback((): void => {
    if (removalPhase !== 'refused') return;
    discard();
    setRemoval(null);
  }, [removalPhase, discard]);

  const openDelete = useCallback((): void => {
    // Not over an Archive already on its way. One that was refused is given
    // up: the User has moved on to deleting, and the sheet's notice is only
    // ever about an answer given in the sheet.
    if (removalPhase === 'sending') return;
    giveUpRemoval();
    setDeleteVisible(true);
  }, [removalPhase, giveUpRemoval]);

  const cancelDelete = useCallback((): void => {
    // `discard` cannot drop an edit that is already being sent.
    if (removalPhase === 'sending') return;
    giveUpRemoval();
    setDeleteVisible(false);
  }, [removalPhase, giveUpRemoval]);

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

  // Why the last push was refused, and the way to send the edit again. One
  // wording for a field and for a delete or archive, as on every screen.
  const writeNotice =
    notice != null ? (
      <InlineNotice
        tone="warning"
        variant="compact"
        message={notice.message}
        actionLabel={notice.action}
        actionIcon="retry"
        onAction={() =>
          void (recoversByReload(writeError)
            ? reloadAfterConflict()
            : retryFailedEdit())
        }
      />
    ) : null;

  const revertNote = (field: TaskField): React.ReactNode =>
    revertedField === field ? writeNotice : null;

  const removalNoticePlace = taskRemovalNoticePlace(
    removalPhase,
    deleteVisible,
  );
  const removing = removalPhase === 'sending' ? (removal?.kind ?? null) : null;

  const created =
    shown === null ? null : describeCreated(shown.createdAt, new Date());

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
      ) : shown === null ? (
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
            onScroll={barRule.onScroll}
            scrollEventThrottle={barRule.scrollEventThrottle}
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
                    selected={readTaskStatus(shown) === value}
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
                value={shown.priority ?? 'medium'}
                onChange={setPriority}
                accessibilityLabel="Priority"
              />
              {revertNote('priority')}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <FieldLabel label="Context" saving={savingField === 'context'} />
              <SegmentedControl
                segments={CONTEXT_SEGMENTS}
                value={shown.context ?? 'none'}
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
                value={shown.dueDate ?? null}
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
              {removalNoticePlace === 'screen' && writeNotice}
              <Button
                label="Archive"
                icon="archive"
                variant="secondary"
                // Its own spinner only when pressed here, not in the sheet.
                busy={removing === 'archive' && !deleteVisible}
                onPress={archive}
              />
              <Button
                label="Delete task"
                icon="trash"
                variant="destructive"
                onPress={openDelete}
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
        // By the removal, not the Task in the copy: a delete in flight has
        // already taken the Task out of it, and the sheet is busy then.
        busy={removing === 'delete'}
        secondaryBusy={removing === 'archive'}
        notice={removalNoticePlace === 'sheet' ? writeNotice : undefined}
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
