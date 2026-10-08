import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  newRecordId,
  useUnconfirmedEdit,
  useVaultBlob,
  recoversByReload,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  putVaultRecord,
  transitionTaskStatus,
  type Task,
  type TaskContext,
  type TaskPriority,
  type TaskStatus,
} from '@myorganizer/vault-core/portable';
import {
  Button,
  Checkbox,
  Chip,
  ChipScroller,
  EmptyState,
  Icon,
  IconButton,
  InlineNotice,
  ListRow,
  ListSection,
  MenuSheet,
  OfflineBanner,
  Screen,
  SegmentedControl,
  Snackbar,
  StatusPill,
  Text,
  TextField,
  useFocusRing,
  useFocusWithin,
  useLargeTitleCollapse,
  usePressFeedback,
  useTheme,
  type ListRowState,
  type StatusTone,
} from '@myorganizer/mobile/ui';
import { TaskPriorityMarker } from './TaskPriorityMarker';
import { formatCalendarDateShort } from './calendarDate';
import { useCalendarDatePicker } from './DateField';
import {
  countDoneThisWeek,
  countVisibleTasks,
  describeClosed,
  describeDue,
  formatEstimate,
  labelledValues,
  localDateOnlyString,
  selectClosedTaskSections,
  selectOpenTaskGroups,
  taskStatus,
  TASK_CONTEXT_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  withTaskOverrides,
  type DecryptedTask,
  type TaskContextFilter,
} from './taskModel';
import { TASKS_ROUTES, type TasksStackParamList } from './tasksStack';
import { TAB_SCREEN_EDGES, TabScreenHeader } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';
import { useRememberedScroll } from './useRememberedScroll';

/** Which due date, if any, a captured Task starts with. */
type DueChoice = 'none' | 'today' | 'tomorrow' | 'custom';

/** Which of the composer's pickers is up. */
type ComposerMenu = 'priority' | 'context';

const CONTEXT_FILTER_LABEL = {
  all: 'All',
  ...TASK_CONTEXT_LABEL,
} as const satisfies Record<TaskContextFilter, string>;

const CONTEXT_SEGMENTS = labelledValues(CONTEXT_FILTER_LABEL).map((value) => ({
  value,
  label: CONTEXT_FILTER_LABEL[value],
}));

/**
 * Which statuses an open row marks with a pill: Blocked as a warning, In
 * progress as a neutral pill, Pending with none. Closed rows never reach it.
 */
const STATUS_PILL = {
  pending: null,
  in_progress: 'neutral',
  blocked: 'warning',
  done: null,
  cancelled: null,
} as const satisfies Record<TaskStatus, StatusTone | null>;

/** What a quick-captured Task lands in when no chip is chosen. */
const CAPTURE_HINT =
  'Return saves. Chips are optional: it lands in No date, Medium, no context.';

/** What just happened, said the way the Snackbar's Undo puts it back. */
interface PendingUndo {
  message: string;
  /** The Task exactly as it stood before the action that can be undone. */
  task: DecryptedTask;
}

function without<V>(
  map: ReadonlyMap<string, V>,
  id: string,
): ReadonlyMap<string, V> {
  if (!map.has(id)) return map;
  const next = new Map(map);
  next.delete(id);
  return next;
}

/**
 * The Tasks tab: the open Tasks grouped Overdue / Today / Upcoming / No
 * date, "Show done" for the Done and then Cancelled Tasks instead, and the
 * quick-capture composer pinned above the tab bar.
 *
 * The checkbox ticks a Task done; the row body opens it. A ticked row fills
 * its box and strikes its title, holds its place for the Motion sheet's dwell,
 * then leaves (ListRow's tick sequence). Swiping right reveals Done, from any
 * open status; swiping left reveals Archive (web only shows Archived Tasks
 * again, per #915). Both a tick and the swipes are row actions too, so a
 * screen reader reaches every one. Done and Archive offer Undo, which puts
 * back the exact Task this screen held before — Blocked stays Blocked.
 * Unticking a Done or Cancelled row moves it straight to Pending through the
 * shared status transition; that reversal needs no Undo of its own.
 *
 * Every edit is pushed to the server as Ciphertext straight away; a failed
 * push puts the row back and offers a retry (ADR 0107).
 */
export function TasksScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<TasksStackParamList>>();
  const rememberedScroll = useRememberedScroll('Tasks');
  const largeTitle = useLargeTitleCollapse();
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

  // A ticked Task, as it stood before the tick, for as long as its row is
  // still dwelling in its group. The edit that closes it is already pushed;
  // this is what keeps the row where it was until ListRow says it has left.
  const [ticking, setTicking] = useState<ReadonlyMap<string, DecryptedTask>>(
    () => new Map(),
  );

  const records = snapshot?.envelope.records;
  const now = new Date();
  const openGroups = useMemo(
    () =>
      selectOpenTaskGroups(
        withTaskOverrides(records, ticking),
        contextFilter,
        new Date(),
      ),
    [records, ticking, contextFilter],
  );
  const closedSections = useMemo(
    () => (showDone ? selectClosedTaskSections(records, contextFilter) : []),
    [records, contextFilter, showDone],
  );
  const openCount = openGroups.reduce(
    (total, group) => total + group.tasks.length,
    0,
  );
  const visibleCount = countVisibleTasks(records);

  const {
    pendingId: pendingTaskId,
    revertedId: revertedTaskId,
    push,
    reloadAfterConflict,
    retryFailedEdit,
  } = useUnconfirmedEdit(apply, retry, reload);

  const [undo, setUndo] = useState<PendingUndo | null>(null);
  // The Task just captured, so its row arrives with the enter beat.
  const [capturedId, setCapturedId] = useState<string | null>(null);

  // --- Quick capture -------------------------------------------------------

  // The composer's own draft. Reset after every capture, not just the title,
  // so a captured "Tomorrow, High, Work" Task is not followed by an
  // identical one by accident.
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueChoice, setDueChoice] = useState<DueChoice>('none');
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority | undefined>();
  const [context, setContext] = useState<TaskContext | undefined>();
  const [menu, setMenu] = useState<ComposerMenu | null>(null);
  // A picker over the composer takes the keyboard's focus with it; the
  // composer stays open under it rather than collapsing as focus leaves.
  const pickerOpen = useRef(false);

  const datePicker = useCalendarDatePicker({
    title: 'Due date',
    clearable: dueChoice === 'custom',
    onChange: (value) => {
      if (value != null) {
        setCustomDate(value);
        setDueChoice('custom');
      } else {
        setCustomDate(null);
        setDueChoice((current) => (current === 'custom' ? 'none' : current));
      }
    },
    onClose: () => {
      pickerOpen.current = false;
    },
  });

  // Focus anywhere in the composer keeps it open; it collapses once focus has
  // left the title, the chips and Save together (#1046). A picker over the
  // composer is not that: it takes the window's focus with it and gives it
  // back.
  const composerFocus = useFocusWithin(() => {
    if (!pickerOpen.current) setComposerOpen(false);
  });

  const resetComposer = useCallback((): void => {
    setTitle('');
    setDueChoice('none');
    setCustomDate(null);
    setPriority(undefined);
    setContext(undefined);
  }, []);

  const collapseComposer = useCallback((): void => {
    setComposerOpen(false);
    Keyboard.dismiss();
  }, []);

  const capture = useCallback((): void => {
    const trimmed = title.trim();
    if (trimmed.length === 0 || writing) return;
    const createdAt = new Date().toISOString();
    const dueDate =
      dueChoice === 'today'
        ? localDateOnlyString(new Date())
        : dueChoice === 'tomorrow'
          ? localDateOnlyString(
              new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                new Date().getDate() + 1,
              ),
            )
          : dueChoice === 'custom' && customDate != null
            ? customDate
            : undefined;
    const task: Task = {
      id: newRecordId(),
      title: trimmed,
      status: 'pending',
      priority: priority ?? 'medium',
      archived: false,
      createdAt,
      ...(dueDate != null ? { dueDate } : {}),
      ...(context != null ? { context } : {}),
    };
    // The draft goes now, not on confirmation: the row appears Unconfirmed
    // at once, and a refused push says so and offers the retry that sends
    // this same Task again.
    resetComposer();
    collapseComposer();
    setCapturedId(task.id);
    void push(task.id, (envelope) => putVaultRecord(envelope, task));
  }, [
    title,
    writing,
    dueChoice,
    customDate,
    priority,
    context,
    push,
    resetComposer,
    collapseComposer,
  ]);

  // --- Done, reopen, archive, undo -----------------------------------------

  /** Swipe right's Done: straight to done, the row leaves at once. */
  const markDone = useCallback(
    (task: DecryptedTask): void => {
      const at = new Date().toISOString();
      void push(task.id, (envelope) =>
        putVaultRecord(
          envelope,
          transitionTaskStatus(task as Task, 'done', at),
        ),
      ).then((confirmed) => {
        if (confirmed) setUndo({ message: 'Task done', task });
      });
    },
    [push],
  );

  /** The checkbox's tick: done now, but the row dwells before it leaves. */
  const tickTask = useCallback(
    (task: DecryptedTask): void => {
      if (ticking.has(task.id)) return;
      setTicking((current) => new Map(current).set(task.id, task));
      const at = new Date().toISOString();
      void push(task.id, (envelope) =>
        putVaultRecord(
          envelope,
          transitionTaskStatus(task as Task, 'done', at),
        ),
      ).then((confirmed) => {
        if (confirmed) setUndo({ message: 'Task done', task });
        // A refused tick puts the row back unticked, with the reason.
        else setTicking((current) => without(current, task.id));
      });
    },
    [push, ticking],
  );

  const tickSettled = useCallback((id: string): void => {
    setTicking((current) => without(current, id));
  }, []);

  /** Puts back the Task exactly as it stood — status, closedAt, archived. */
  const restore = useCallback(
    (task: DecryptedTask): void => {
      // Only `updatedAt` moves, because the restore is a real edit of its
      // own and not a silent no-op.
      void push(task.id, (envelope) =>
        putVaultRecord(envelope, {
          ...(task as Task),
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    [push],
  );

  /** An untick while the row is still dwelling: the tick is taken back. */
  const untickDwelling = useCallback(
    (id: string): void => {
      const task = ticking.get(id);
      if (task === undefined) return;
      setTicking((current) => without(current, id));
      setUndo(null);
      restore(task);
    },
    [ticking, restore],
  );

  const reopenToPending = useCallback(
    (task: DecryptedTask): void => {
      const at = new Date().toISOString();
      void push(task.id, (envelope) =>
        putVaultRecord(
          envelope,
          transitionTaskStatus(task as Task, 'pending', at),
        ),
      );
    },
    [push],
  );

  const archiveTask = useCallback(
    (task: DecryptedTask): void => {
      void push(task.id, (envelope) =>
        putVaultRecord(envelope, {
          ...(task as Task),
          archived: true,
          updatedAt: new Date().toISOString(),
        }),
      ).then((confirmed) => {
        if (confirmed) setUndo({ message: 'Task archived', task });
      });
    },
    [push],
  );

  const undoLastAction = useCallback((): void => {
    if (undo === null) return;
    const { task } = undo;
    setUndo(null);
    setTicking((current) => without(current, task.id));
    restore(task);
  }, [undo, restore]);

  const openDetail = useCallback(
    (taskId: string): void => {
      navigation.navigate(TASKS_ROUTES.detail, { taskId });
    },
    [navigation],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      rememberedScroll.onScroll(event);
      largeTitle.onScroll(event);
    },
    [rememberedScroll, largeTitle],
  );

  // --- Rows ------------------------------------------------------------------

  const notice = writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
  const onRetry = recoversByReload(writeError)
    ? reloadAfterConflict
    : retryFailedEdit;

  const rowState = (id: string): ListRowState =>
    pendingTaskId === id
      ? 'unconfirmed'
      : revertedTaskId === id && writeError != null
        ? 'reverted'
        : 'normal';

  // The meta line starts under the title, past the priority marker (14) and
  // its gap, as the sheet indents it.
  const metaInset = MARKER_WIDTH + theme.spacing.sm;

  const renderTaskRow = (
    task: DecryptedTask,
    closed: boolean,
  ): React.JSX.Element => {
    const taskTitle = task.title ?? 'Untitled task';
    const ticked = ticking.has(task.id);
    const status = taskStatus(task);
    const due = closed ? null : describeDue(task.dueDate, now);
    const lead = closed ? describeClosed(task, now) : (due?.text ?? null);
    const rest = [
      task.context != null ? TASK_CONTEXT_LABEL[task.context] : null,
      formatEstimate(task.estimatedMinutes),
    ].filter((part): part is string => part != null);
    const parts = lead != null ? [lead, ...rest] : rest;
    const pillTone = closed ? null : STATUS_PILL[status];
    const pillLabel = pillTone == null ? null : TASK_STATUS_LABEL[status];
    const priorityLabel = `${TASK_PRIORITY_LABEL[task.priority ?? 'medium']} priority`;

    const subtitle =
      parts.length > 0 || pillLabel != null ? parts.join(' · ') : undefined;
    const tail = rest.length > 0 ? rest.join(' · ') : null;

    return (
      <ListRow
        key={task.id}
        size="tall"
        title={taskTitle}
        titleAccessory={<TaskPriorityMarker priority={task.priority} />}
        subtitle={subtitle}
        subtitleContent={
          <Text
            variant="caption"
            numberOfLines={1}
            style={[styles.meta, { paddingLeft: metaInset }]}
          >
            {due?.overdue === true ? (
              <Text variant="caption" weight="semibold" color="warning">
                {lead}
              </Text>
            ) : (
              lead
            )}
            {lead != null && tail != null ? ' · ' : null}
            {tail}
          </Text>
        }
        subtitleAccessory={
          pillTone != null && pillLabel != null ? (
            <StatusPill label={pillLabel} tone={pillTone} />
          ) : undefined
        }
        accessibilityLabel={[taskTitle, priorityLabel, ...parts, pillLabel]
          .filter((part): part is string => part != null)
          .join(', ')}
        checked={closed || ticked}
        tickTarget="leading"
        onTickSettled={() => tickSettled(task.id)}
        entering={task.id === capturedId}
        onPress={() => openDetail(task.id)}
        leading={
          <Checkbox
            checked={closed || ticked}
            disabled={writing}
            accessibilityLabel={`Done: ${taskTitle}`}
            onChange={(next) => {
              if (closed) reopenToPending(task);
              else if (next) tickTask(task);
              else untickDwelling(task.id);
            }}
          />
        }
        leftActions={
          closed
            ? undefined
            : [
                {
                  id: 'done',
                  label: 'Done',
                  icon: 'check',
                  tone: 'primary',
                  onPress: () => markDone(task),
                },
              ]
        }
        rightActions={
          closed
            ? undefined
            : [
                {
                  id: 'archive',
                  label: 'Archive',
                  icon: 'archive',
                  tone: 'neutral',
                  onPress: () => archiveTask(task),
                },
              ]
        }
        innerActions={
          closed
            ? [
                {
                  id: 'reopen',
                  label: 'Put back to Pending',
                  onPress: () => reopenToPending(task),
                },
              ]
            : undefined
        }
        state={rowState(task.id)}
        revertedReason={notice?.message}
        retryLabel={notice?.action}
        onRetry={onRetry}
      />
    );
  };

  // A refused capture leaves no row to carry its note — the Task was never
  // saved — so the note stands above the list instead.
  const shownIds = new Set(
    (showDone
      ? closedSections.flatMap((section) => section.tasks)
      : openGroups.flatMap((group) => group.tasks)
    ).map((task) => task.id),
  );
  const orphanedRevert =
    notice != null && revertedTaskId != null && !shownIds.has(revertedTaskId);

  const showCountRow = showDone || openCount > 0;

  const renderBody = (): React.ReactNode => {
    if (showDone) {
      if (closedSections.length === 0) {
        return (
          <EmptyState
            icon="tasks"
            title="Nothing done yet"
            description="Tick a Task and it lands here."
          />
        );
      }
      return (
        <>
          {closedSections.map((section) => (
            <ListSection
              key={section.key}
              title={section.label}
              count={section.tasks.length}
              style={{ marginBottom: theme.spacing.sm }}
            >
              {section.tasks.map((task) => renderTaskRow(task, true))}
            </ListSection>
          ))}
          <Text
            variant="caption"
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
            }}
          >
            Untick a Task to put it back to Pending.
          </Text>
        </>
      );
    }
    if (visibleCount === 0) {
      return (
        <EmptyState
          icon="tasks"
          title="No tasks yet"
          description="Type one in below. Return saves it."
        />
      );
    }
    if (openCount === 0) {
      const done = countDoneThisWeek(records, contextFilter, now);
      return (
        <EmptyState
          icon="check"
          tone="success"
          title="All clear"
          description={
            done === 0
              ? 'Nothing open.'
              : `Nothing open. ${done} ${done === 1 ? 'Task' : 'Tasks'} done this week.`
          }
          actionLabel="Show done"
          actionVariant="secondary"
          onAction={() => setShowDone(true)}
        />
      );
    }
    return openGroups.map((group) => (
      <ListSection
        key={group.key}
        title={group.label}
        count={group.tasks.length}
        warning={group.key === 'overdue'}
        style={{ marginBottom: theme.spacing.sm }}
      >
        {group.tasks.map((task) => renderTaskRow(task, false))}
      </ListSection>
    ));
  };

  // --- Composer ----------------------------------------------------------------

  const dueLabel =
    dueChoice === 'today'
      ? 'Today'
      : dueChoice === 'tomorrow'
        ? 'Tomorrow'
        : dueChoice === 'custom' && customDate != null
          ? formatCalendarDateShort(customDate)
          : null;
  const chosen = [
    dueLabel,
    priority != null ? TASK_PRIORITY_LABEL[priority] : null,
    context != null ? TASK_CONTEXT_LABEL[context] : null,
  ].filter((part): part is string => part != null);
  const captureHint =
    chosen.length === 0
      ? CAPTURE_HINT
      : `${chosen.join(' · ')}. Return saves; the chips reset for the next one.`;

  const openPicker = (open: () => void): void => {
    pickerOpen.current = true;
    open();
  };

  return (
    <Screen edges={TAB_SCREEN_EDGES} noPadding>
      <TabScreenHeader title="Tasks" collapsed={largeTitle.collapsed} />

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
            message={describeVaultLoadError(loadError, 'your tasks')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.fill} behavior="padding">
          <View style={styles.fill}>
            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              keyboardShouldPersistTaps="handled"
              stickyHeaderIndices={[0]}
              contentContainerStyle={[
                styles.content,
                { paddingBottom: theme.spacing.xl },
              ]}
              showsVerticalScrollIndicator={false}
              contentOffset={rememberedScroll.contentOffset}
              onScroll={onScroll}
              scrollEventThrottle={rememberedScroll.scrollEventThrottle}
            >
              {/* The filter and the count stay put while the groups scroll. */}
              <View style={{ backgroundColor: theme.colors.background }}>
                <OfflineBanner />
                <View
                  style={{
                    paddingHorizontal: theme.spacing.md,
                    paddingTop: theme.spacing.xs,
                    paddingBottom: theme.spacing.sm,
                    gap: theme.spacing.sm,
                  }}
                >
                  <SegmentedControl
                    segments={CONTEXT_SEGMENTS}
                    value={contextFilter}
                    onChange={setContextFilter}
                    accessibilityLabel="Filter tasks by context"
                  />
                  {showCountRow && (
                    <View style={styles.countRow}>
                      <Text variant="caption">
                        {showDone
                          ? 'Done Tasks, most recent first'
                          : `${openCount} open`}
                      </Text>
                      <Chip
                        label="Show done"
                        icon="check"
                        selected={showDone}
                        onPress={() => setShowDone((current) => !current)}
                      />
                    </View>
                  )}
                  {orphanedRevert && notice != null && (
                    <InlineNotice
                      tone="warning"
                      variant="compact"
                      message={notice.message}
                      actionLabel={notice.action}
                      actionIcon="retry"
                      onAction={() => void onRetry()}
                    />
                  )}
                </View>
              </View>
              <View style={styles.fill}>{renderBody()}</View>
            </ScrollView>

            {/* Above the composer and over the list, never pushing it. */}
            <View pointerEvents="box-none" style={styles.snackbarDock}>
              <Snackbar
                visible={undo !== null}
                message={undo?.message ?? ''}
                actionLabel="Undo"
                onAction={undoLastAction}
                onDismiss={() => setUndo(null)}
              />
            </View>
          </View>

          {/* Quick capture: docked above the tab bar, not part of the scroll
              content, so it stays reachable while browsing any group. */}
          {composerOpen ? (
            <View
              // A view of its own on Android, so Tab walks it in reading
              // order. Flattened, it is a sibling of its own controls that
              // spans both their rows, and Android then orders the lot left
              // to right: the chips, then the title, then Save.
              collapsable={false}
              onFocus={composerFocus.onFocus}
              onBlur={composerFocus.onBlur}
              style={[
                styles.composer,
                {
                  borderTopColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  paddingTop: theme.spacing.md,
                  paddingBottom: theme.spacing.sm,
                  gap: theme.spacing.sm,
                },
              ]}
            >
              <View
                style={[
                  styles.captureRow,
                  {
                    gap: theme.spacing.sm,
                    paddingLeft: theme.spacing.md,
                    paddingRight: theme.spacing.md,
                  },
                ]}
              >
                <TextField
                  autoFocus
                  autoFocusPromptly
                  placeholder="Add a task"
                  value={title}
                  onChangeText={setTitle}
                  onSubmitEditing={capture}
                  returnKeyType="done"
                  accessibilityLabel="New task title"
                  containerStyle={styles.captureInput}
                />
                <IconButton
                  icon="arrowUp"
                  variant="filled"
                  accessibilityLabel="Save task"
                  onPress={capture}
                  disabled={writing || title.trim().length === 0}
                />
              </View>
              <ChipScroller>
                <Chip
                  label="Today"
                  icon="calendar"
                  selected={dueChoice === 'today'}
                  onPress={() =>
                    setDueChoice((current) =>
                      current === 'today' ? 'none' : 'today',
                    )
                  }
                />
                <Chip
                  label="Tomorrow"
                  icon="calendar"
                  selected={dueChoice === 'tomorrow'}
                  onPress={() =>
                    setDueChoice((current) =>
                      current === 'tomorrow' ? 'none' : 'tomorrow',
                    )
                  }
                />
                <Chip
                  label={
                    dueChoice === 'custom' && customDate != null
                      ? formatCalendarDateShort(customDate)
                      : 'Pick date'
                  }
                  accessibilityLabel={
                    dueChoice === 'custom' && customDate != null
                      ? `Due ${formatCalendarDateShort(customDate)}. Pick date`
                      : 'Pick date'
                  }
                  icon="calendar"
                  selected={dueChoice === 'custom'}
                  onPress={() =>
                    openPicker(() =>
                      datePicker.open(
                        dueChoice === 'custom' ? customDate : null,
                      ),
                    )
                  }
                />
                <Chip
                  label={
                    priority != null
                      ? `${TASK_PRIORITY_LABEL[priority]} priority`
                      : 'Priority'
                  }
                  icon="tag"
                  selected={priority != null}
                  onPress={() => openPicker(() => setMenu('priority'))}
                />
                <Chip
                  label={
                    context != null ? TASK_CONTEXT_LABEL[context] : 'Context'
                  }
                  icon="tag"
                  selected={context != null}
                  onPress={() => openPicker(() => setMenu('context'))}
                />
              </ChipScroller>
              <Text
                variant="caption"
                style={{ paddingHorizontal: theme.spacing.md }}
              >
                {captureHint}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.composer,
                {
                  borderTopColor: theme.colors.border,
                  backgroundColor: theme.colors.background,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.md,
                },
              ]}
            >
              <CollapsedComposer
                draft={title}
                onPress={() => setComposerOpen(true)}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {datePicker.sheet}

      <MenuSheet
        visible={menu === 'priority'}
        title="Priority"
        onDismiss={() => {
          pickerOpen.current = false;
          setMenu(null);
        }}
        items={labelledValues(TASK_PRIORITY_LABEL).map((value) => ({
          id: value,
          label: TASK_PRIORITY_LABEL[value],
          selected: (priority ?? 'medium') === value,
          role: 'radio' as const,
          onPress: () => setPriority(value),
        }))}
      />
      <MenuSheet
        visible={menu === 'context'}
        title="Context"
        onDismiss={() => {
          pickerOpen.current = false;
          setMenu(null);
        }}
        items={[
          {
            id: 'none',
            label: 'None',
            selected: context == null,
            role: 'radio' as const,
            onPress: () => setContext(undefined),
          },
          ...labelledValues(TASK_CONTEXT_LABEL).map((value) => ({
            id: value,
            label: TASK_CONTEXT_LABEL[value],
            selected: context === value,
            role: 'radio' as const,
            onPress: () => setContext(value),
          })),
        ]}
      />
    </Screen>
  );
}

/** The priority marker's width, which the meta line indents past. */
const MARKER_WIDTH = 14;

/**
 * The composer while it is not being typed into: a field-shaped button that
 * opens it, showing the unsent draft if there is one (Tasks · Capture ·
 * Collapsed).
 */
function CollapsedComposer({
  draft,
  onPress,
}: {
  draft: string;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const feedback = usePressFeedback('bounded');
  const focus = useFocusRing();
  const hasDraft = draft.trim().length > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasDraft ? `Add a task: ${draft}` : 'Add a task'}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={feedback.android_ripple}
      style={({ pressed }) => [
        styles.collapsed,
        {
          minHeight: COMPOSER_FIELD_HEIGHT,
          // The sheet pads 14 in and sets the glyph 10 from the words: the
          // nearer steps.
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
          borderRadius: theme.radii.md,
          borderColor: theme.colors.controlEdge,
          backgroundColor: theme.colors.card,
        },
        feedback.pressedStyle(pressed),
        focus.ringStyle,
      ]}
    >
      <Icon name="plus" size={20} strokeWidth={2.4} />
      <Text
        variant="body"
        color={hasDraft ? 'foreground' : 'mutedForeground'}
        numberOfLines={1}
        style={styles.grow}
      >
        {hasDraft ? draft : 'Add a task'}
      </Text>
    </Pressable>
  );
}

/** The collapsed composer's height — TextField's, on the Inputs sheet. */
const COMPOSER_FIELD_HEIGHT = 48;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    flexShrink: 1,
  },
  snackbarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  captureInput: {
    flex: 1,
  },
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  grow: {
    flexShrink: 1,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
