import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  useIsFocused,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  setKeepScreenAwake,
  useKeepAwake,
  useKeepScreenAwakeSetting,
} from '@myorganizer/mobile/core';
import {
  newRecordId,
  useUnconfirmedEdit,
  useVaultBlob,
  useVaultSession,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import {
  createCatalogItemAndAddLine,
  deleteListLine,
  putListLine,
  renameGroceryList,
  removeCheckedListLines,
  setListLineAmount,
  setListLineChecked,
  uncheckAllListLines,
  type CatalogItem,
  type GroceryCategoryType,
  type ListLine,
} from '@myorganizer/vault-core/portable';
import {
  Button,
  Checkbox,
  ConfirmSheet,
  EmptyState,
  Icon,
  IconButton,
  InlineNotice,
  ListRow,
  ListSection,
  ListSectionRows,
  LockAction,
  MIN_TOUCH_TARGET,
  MenuSheet,
  OfflineBanner,
  Screen,
  Snackbar,
  Text,
  TextField,
  TextPromptSheet,
  haptics,
  useFocusRing,
  useLargeTitleCollapse,
  usePressFeedback,
  useTheme,
  type ListRowState,
  type MenuSheetItem,
} from '@myorganizer/mobile/ui';
import { AddToListSheet, type JustAddedLine } from './AddToListSheet';
import { GroceryFooterButton } from './GroceryFooterButton';
import { GroceryProgressBar } from './GroceryProgressBar';
import {
  GROCERIES_ROUTES,
  type GroceriesStackParamList,
} from './groceriesStack';
import {
  buildTripView,
  catalogItemIdsOnList,
  checkedFraction,
  describeLineRemoved,
  describeRemaining,
  describeUncheckAll,
  readCatalogEntries,
  removeCheckedLabel,
  type CatalogEntry,
  type TripLine,
} from './groceryTripModel';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';
import { useRememberedScroll } from './useRememberedScroll';

/** Which list-level menu action, if any, is mid-flight or reverted. */
type BulkAction = 'uncheckAll' | 'removeChecked' | 'rename';

/** The ConfirmSheet-gated menu actions. Rename opens a TextPromptSheet. */
type ConfirmAction = 'uncheckAll' | 'removeChecked';

/**
 * What each ConfirmSheet-gated menu action says it will do, for a list with
 * `checked` Checked lines (Groc-Trip-ConfirmUncheck, -ConfirmRemove). Both
 * are `primary`, not destructive: neither deletes anything the Catalog does
 * not keep, and red is reserved for what cannot be undone.
 */
const CONFIRM_COPY = {
  uncheckAll: (checked: number) => ({
    title: 'Uncheck All?',
    message: describeUncheckAll(checked),
    confirmLabel: 'Uncheck All',
  }),
  removeChecked: (checked: number) => ({
    title: 'Remove Checked From List?',
    message: 'Checked lines leave this list. Your Catalog keeps the items.',
    confirmLabel: removeCheckedLabel(checked),
  }),
} as const satisfies Record<
  ConfirmAction,
  (checked: number) => { title: string; message: string; confirmLabel: string }
>;

/** The inline amount field's width in the row's amount slot (Groc-Trip-Amount). */
const AMOUNT_FIELD_WIDTH = 112;

/** The line the Add sheet last added, by the id its Vault Push runs under. */
interface AddedLine {
  lineId: string;
  name: string;
  category: GroceryCategoryType;
}

export function GroceryTripScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<
        GroceriesStackParamList,
        typeof GROCERIES_ROUTES.trip
      >
    >();
  const { listId } =
    useRoute<RouteProp<GroceriesStackParamList, typeof GROCERIES_ROUTES.trip>>()
      .params;
  const { lock } = useVaultSession();
  const rememberedScroll = useRememberedScroll(`GroceryTrip:${listId}`);
  const titleCollapse = useLargeTitleCollapse();

  const {
    snapshot,
    loading,
    loadError,
    writing,
    writeError,
    reload,
    apply,
    retry,
  } = useVaultBlob(VaultBlobType.Groceries);

  // Lines ticked a moment ago whose rows are still playing the tick sequence.
  // They stay under their category until the row reports it has left.
  const [settlingIds, setSettlingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // The line that has just arrived in Checked, which plays the enter beat.
  const [enteredId, setEnteredId] = useState<string | null>(null);

  const trip = useMemo(
    () => buildTripView(snapshot?.envelope.records, listId, settlingIds),
    [snapshot, listId, settlingIds],
  );
  const checkedCount = trip === null ? 0 : trip.total - trip.remaining;

  // "Keep screen on" (#908 story 36): held while this list is the screen in
  // front and the Device Setting is on, and let go the moment either stops.
  const isFocused = useIsFocused();
  const keepScreenOn = useKeepScreenAwakeSetting();
  useKeepAwake(isFocused && keepScreenOn && trip !== null);

  // Which line the screen is showing an Unconfirmed Edit for, and which one
  // was put back when a push failed.
  const {
    pendingId: unconfirmedLineId,
    revertedId: revertedLineId,
    push,
    reloadAfterConflict,
    retryFailedEdit,
  } = useUnconfirmedEdit(apply, retry, reload);
  // The same Unconfirmed Edit shape one level up, for an edit that is not
  // about one line — Uncheck All, Remove Checked From List, Rename. A second,
  // independent call rather than reusing the one above: the hook runs one
  // write at a time, but a line edit and a list-level edit are two different
  // id spaces and must not be told apart by comparing a line id to an action
  // name.
  const {
    pendingId: bulkPending,
    revertedId: bulkReverted,
    push: pushBulk,
    reloadAfterConflict: reloadAfterBulkConflict,
    retryFailedEdit: retryBulkAction,
  } = useUnconfirmedEdit<BulkAction>(apply, retry, reload);

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
  // What Undo would put back. Held only while the Snackbar is up, and never
  // written anywhere: an Undo that outlives the screen is an edit in a queue,
  // which mobile does not keep (ADR 0107).
  const [deletedLine, setDeletedLine] = useState<TripLine | null>(null);

  // The Add-to-list sheet, the trip view's own "⋯" menu, and the sheets that
  // menu opens.
  const [addVisible, setAddVisible] = useState(false);
  const [addedLine, setAddedLine] = useState<AddedLine | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [checkedOpen, setCheckedOpen] = useState(false);

  const catalog = useMemo(
    () => readCatalogEntries(snapshot?.envelope.records),
    [snapshot],
  );
  const onListItemIds = useMemo(
    () => catalogItemIdsOnList(snapshot?.envelope.records, listId),
    [snapshot, listId],
  );

  const openMenu = useCallback((): void => setMenuVisible(true), []);

  // One scroll view feeds two listeners: where to reopen after a lock, and
  // whether the Android large title has scrolled away. (iOS's native large
  // title collapses itself.)
  const { onScroll: rememberScroll } = rememberedScroll;
  const { onScroll: collapseTitle } = titleCollapse;
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      rememberScroll(event);
      collapseTitle(event);
    },
    [rememberScroll, collapseTitle],
  );

  // The header: back to Groceries, the list's name as a large title that
  // collapses into the bar on scroll, and "⋯ List actions" beside Lock. iOS
  // draws the large title natively; Android's native stack has none, so the
  // screen draws it at the top of its content and the bar takes the name only
  // once that has scrolled away.
  const inlineTitle =
    Platform.OS === 'ios' || titleCollapse.collapsed ? (trip?.name ?? '') : '';
  useLayoutEffect(() => {
    navigation.setOptions({
      title: inlineTitle,
      headerLargeTitle: Platform.OS === 'ios',
      headerRight: () => (
        <View style={styles.headerActions}>
          <IconButton
            icon="more"
            accessibilityLabel="List actions"
            onPress={openMenu}
          />
          <LockAction onPress={() => lock('manual')} />
        </View>
      ),
    });
  }, [navigation, inlineTitle, openMenu, lock]);

  const menuItems = useMemo((): MenuSheetItem[] => {
    // Uncheck All and Remove Checked From List have nothing to act on until
    // something is checked, so they are offered only once it is.
    const bulk: MenuSheetItem[] =
      checkedCount === 0
        ? []
        : [
            {
              id: 'uncheckAll',
              label: 'Uncheck All',
              icon: 'undo',
              onPress: () => setConfirmAction('uncheckAll'),
            },
            {
              id: 'removeChecked',
              label: 'Remove Checked From List',
              icon: 'listRemove',
              onPress: () => setConfirmAction('removeChecked'),
            },
          ];
    return [
      ...bulk,
      {
        id: 'rename',
        label: 'Rename list',
        icon: 'pencil',
        onPress: () => setRenameVisible(true),
      },
      {
        id: 'keepScreenOn',
        label: 'Keep screen on',
        icon: 'sun',
        role: 'switch',
        selected: keepScreenOn,
        value: keepScreenOn ? 'On' : 'Off',
        keepOpen: true,
        onPress: () => setKeepScreenAwake(!keepScreenOn),
      },
    ];
  }, [checkedCount, keepScreenOn]);

  const addExistingItem = useCallback(
    (item: CatalogEntry): void => {
      const now = new Date().toISOString();
      const line: ListLine = {
        id: newRecordId(),
        catalogItemId: item.id,
        checked: false,
        createdAt: now,
        updatedAt: now,
      };
      setAddedLine({
        lineId: line.id,
        name: item.name,
        category: item.category,
      });
      void push(line.id, (envelope) => putListLine(envelope, listId, line));
    },
    [push, listId],
  );

  const createItemAndAdd = useCallback(
    (name: string, category: GroceryCategoryType): void => {
      const now = new Date().toISOString();
      const item: CatalogItem = {
        id: newRecordId(),
        name,
        category,
        createdAt: now,
        updatedAt: now,
      };
      const line: ListLine = {
        id: newRecordId(),
        catalogItemId: item.id,
        checked: false,
        createdAt: now,
        updatedAt: now,
      };
      setAddedLine({ lineId: line.id, name, category });
      void push(line.id, (envelope) =>
        createCatalogItemAndAddLine(envelope, listId, item, line),
      );
    },
    [push, listId],
  );

  const openAdd = useCallback((): void => {
    setAddedLine(null);
    setAddVisible(true);
  }, []);

  const confirmBulkAction = useCallback((): void => {
    if (confirmAction === null) return;
    const action = confirmAction;
    const now = new Date().toISOString();
    void pushBulk(
      action,
      action === 'uncheckAll'
        ? (envelope) => uncheckAllListLines(envelope, listId, now)
        : (envelope) => removeCheckedListLines(envelope, listId, now),
    ).then(() => setConfirmAction(null));
  }, [confirmAction, pushBulk, listId]);

  const cancelBulkConfirm = useCallback((): void => {
    if (bulkPending !== null) return;
    setConfirmAction(null);
  }, [bulkPending]);

  const submitRename = useCallback(
    (name: string): void => {
      const now = new Date().toISOString();
      void pushBulk('rename', (envelope) =>
        renameGroceryList(envelope, listId, name, now),
      ).then(() => setRenameVisible(false));
    },
    [pushBulk, listId],
  );

  const cancelRename = useCallback((): void => {
    if (bulkPending !== null) return;
    setRenameVisible(false);
  }, [bulkPending]);

  const setChecked = useCallback(
    (line: TripLine): void => {
      const next = !line.checked;
      // A tick keeps the row where it is for the tick sequence; an untick —
      // including one inside the dwell — lets go of it.
      setSettlingIds((current) => {
        const updated = new Set(current);
        if (next) updated.add(line.id);
        else updated.delete(line.id);
        return updated;
      });
      const now = new Date().toISOString();
      void push(line.id, (envelope) =>
        setListLineChecked(envelope, listId, line.id, next, now),
      );
    },
    [push, listId],
  );

  // The row has struck, dwelt, and left: move the line to Checked.
  const settleTick = useCallback((lineId: string): void => {
    setSettlingIds((current) => {
      if (!current.has(lineId)) return current;
      const updated = new Set(current);
      updated.delete(lineId);
      return updated;
    });
    setEnteredId(lineId);
  }, []);

  // The whole row is the tick target, and a tap on it has to feel like a tap
  // on the box — the Checkbox fires its own haptic, so only the row's needs
  // firing here.
  const setCheckedFromRow = useCallback(
    (line: TripLine): void => {
      if (line.checked) haptics.untick();
      else haptics.tick();
      setChecked(line);
    },
    [setChecked],
  );

  const beginAmountEdit = useCallback((line: TripLine): void => {
    setAmountDraft(line.amount ?? '');
    setEditingLineId(line.id);
  }, []);

  const commitAmount = useCallback(
    (line: TripLine): void => {
      setEditingLineId(null);
      const next = amountDraft.trim();
      if (next === (line.amount ?? '')) return;
      const now = new Date().toISOString();
      void push(line.id, (envelope) =>
        setListLineAmount(envelope, listId, line.id, next, now),
      );
    },
    [amountDraft, push, listId],
  );

  const removeLine = useCallback(
    async (line: TripLine): Promise<void> => {
      const now = new Date().toISOString();
      const removed = await push(line.id, (envelope) =>
        deleteListLine(envelope, listId, line.id, now),
      );
      // Undo is offered only once the delete is on the server. A push that
      // failed already put the line back, so there is nothing to undo.
      if (removed) setDeletedLine(line);
    },
    [push, listId],
  );

  const undoRemove = useCallback((): void => {
    if (deletedLine === null) return;
    setDeletedLine(null);
    const now = new Date().toISOString();
    // A new line rather than the old one: the deleted line's id is in the
    // Deletion Log for good, so a merge would bury it again.
    const restored: ListLine = {
      id: newRecordId(),
      catalogItemId: deletedLine.catalogItemId,
      checked: deletedLine.checked,
      ...(deletedLine.amount != null ? { amount: deletedLine.amount } : {}),
      createdAt: now,
      updatedAt: now,
    };
    void push(restored.id, (envelope) =>
      putListLine(envelope, listId, restored),
    );
  }, [deletedLine, push, listId]);

  // `writeError` and not `revertedLineId` alone: the hook also refuses an
  // edit while another request is in flight, and that refusal is not a
  // revert — nothing was sent, nothing came back, and there is nothing to say
  // about it. Marking the row reverted there leaves a row wearing a state
  // with no message under it.
  const rowState = (lineId: string): ListRowState =>
    unconfirmedLineId === lineId
      ? 'unconfirmed'
      : revertedLineId === lineId && writeError != null
        ? 'reverted'
        : 'normal';

  const notice = writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
  const retryLineEdit =
    writeError === 'conflict' ? reloadAfterConflict : retryFailedEdit;

  const renderLine = (
    line: TripLine,
    inChecked: boolean,
  ): React.JSX.Element => {
    const editing = editingLineId === line.id;
    // An amount is edited on a line still to pick up; in Checked it is plain
    // text, and a tap there unchecks (Groc-Trip-CheckedOpen).
    const amountEditable = !line.checked;

    return (
      <View key={line.id}>
        <ListRow
          title={line.name}
          titleWeight="medium"
          size="comfortable"
          checked={line.checked}
          onTickSettled={inChecked ? undefined : () => settleTick(line.id)}
          entering={inChecked && enteredId === line.id}
          accessibilityLabel={
            line.amount == null ? line.name : `${line.name}, ${line.amount}`
          }
          // Not pressable while a push is in flight: the hook takes one write
          // at a time and would drop this tap on the floor, which reads as a
          // row that ignored being tapped.
          onPress={writing ? undefined : () => setCheckedFromRow(line)}
          leading={
            <Checkbox
              checked={line.checked}
              size="large"
              disabled={writing}
              accessibilityLabel={line.name}
              onChange={() => setChecked(line)}
            />
          }
          value={amountEditable ? undefined : line.amount}
          trailing={
            amountEditable ? (
              <AmountButton
                amount={line.amount}
                disabled={writing}
                onPress={() => beginAmountEdit(line)}
              />
            ) : null
          }
          // The amount button is drawn inside the row, and a row is one
          // accessibility element — so the button is not reachable on its own
          // and the row offers it as an action instead.
          innerActions={
            amountEditable
              ? [
                  {
                    id: 'amount',
                    label:
                      line.amount == null ? 'Add an amount' : 'Edit amount',
                    onPress: () => beginAmountEdit(line),
                  },
                ]
              : []
          }
          rightActions={[
            {
              id: 'delete',
              label: 'Delete',
              icon: 'trash',
              // Neutral, not destructive: a Delete List Line drops one line
              // from one trip and leaves the Catalog Item alone, and Undo is
              // right there. A red panel promises something worse than it does.
              tone: 'neutral',
              onPress: () => void removeLine(line),
            },
          ]}
          state={rowState(line.id)}
          revertedReason={notice?.message}
          retryLabel={notice?.action}
          onRetry={retryLineEdit}
        />

        {/* The amount is edited in the row's own amount slot, as drawn — but
            laid over the row as its sibling rather than inside it. The row is
            one accessibility element, so a field drawn inside it is one a
            screen reader cannot move into; beside it, the field is reachable
            and still sits where the amount was. */}
        {editing && (
          <View
            style={[styles.amountSlot, { right: theme.spacing.md }]}
            pointerEvents="box-none"
          >
            <TextField
              accessibilityLabel={`Amount for ${line.name}`}
              value={amountDraft}
              onChangeText={setAmountDraft}
              onBlur={() => commitAmount(line)}
              onSubmitEditing={() => commitAmount(line)}
              returnKeyType="done"
              autoFocus
              selectTextOnFocus
              containerStyle={styles.amountField}
            />
          </View>
        )}
      </View>
    );
  };

  // An Undo re-adds under a *fresh* line id, so a refused Undo reverts to a
  // copy that holds no line with that id and there is no row to put the
  // reason under. Without this the Undo simply vanishes and the User is never
  // told it failed. (A refused add is told in the Add sheet, while it is up.)
  const revertedOffScreen =
    writeError != null &&
    revertedLineId !== null &&
    trip !== null &&
    !(addVisible && addedLine?.lineId === revertedLineId) &&
    ![
      ...trip.groups.flatMap((group) => group.lines),
      ...trip.checkedLines,
    ].some((line) => line.id === revertedLineId);

  const justAdded: JustAddedLine | null =
    addedLine === null
      ? null
      : {
          name: addedLine.name,
          category: addedLine.category,
          state: rowState(addedLine.lineId),
        };

  // The scroll view's children, built as a list so the category headers can
  // be named as its sticky headers: a header sticks only as a direct child.
  const content: React.ReactNode[] = [];
  const stickyIndices: number[] = [];
  if (trip !== null) {
    // The offline strip stays pinned under the header (Groc-Trip-Reverted).
    stickyIndices.push(content.length);
    content.push(
      <View key="banner">
        <OfflineBanner />
      </View>,
    );

    if (Platform.OS === 'android') {
      content.push(
        <Text
          key="title"
          variant="display"
          accessibilityRole="header"
          style={{ paddingHorizontal: theme.spacing.md }}
        >
          {trip.name}
        </Text>,
      );
    }

    content.push(
      <View
        key="progress"
        style={[
          styles.progress,
          {
            // The sheet's 48pt row with 12 between its parts; 12 falls
            // exactly between two steps and a tie rounds up.
            minHeight: 48,
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      >
        <Text
          variant="bodySm"
          weight={trip.total === 0 ? undefined : 'bold'}
          color={trip.total === 0 ? 'mutedForeground' : 'foreground'}
          style={styles.figures}
        >
          {describeRemaining(trip.remaining, trip.total)}
        </Text>
        {trip.total > 0 ? (
          <GroceryProgressBar
            size="trip"
            fraction={checkedFraction(trip.remaining, trip.total)}
          />
        ) : (
          <View style={styles.grow} />
        )}
        {keepScreenOn && <ScreenOnPill />}
      </View>,
    );

    if (revertedOffScreen && notice != null) {
      content.push(
        <InlineNotice
          key="revertedOffScreen"
          tone="destructive"
          message={notice.message}
          actionLabel={notice.action}
          onAction={() => void retryLineEdit()}
          style={{
            marginHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.sm,
          }}
        />,
      );
    }

    if (bulkReverted != null && notice != null) {
      content.push(
        <InlineNotice
          key="bulkReverted"
          tone="destructive"
          message={notice.message}
          actionLabel={notice.action}
          onAction={() =>
            void (writeError === 'conflict'
              ? reloadAfterBulkConflict()
              : retryBulkAction())
          }
          style={{
            marginHorizontal: theme.spacing.md,
            marginBottom: theme.spacing.sm,
          }}
        />,
      );
    }

    if (trip.total === 0) {
      content.push(
        <EmptyState
          key="empty"
          icon="groceries"
          title="Nothing on this list yet"
          description="Add what you need for this trip."
        />,
      );
    }

    for (const group of trip.groups) {
      stickyIndices.push(content.length);
      content.push(
        <ListSection
          key={`${group.category}-header`}
          title={group.label}
          count={group.lines.length}
          style={{ backgroundColor: theme.colors.background }}
        />,
      );
      content.push(
        <ListSectionRows key={`${group.category}-rows`}>
          {group.lines.map((line) => renderLine(line, false))}
        </ListSectionRows>,
      );
    }

    if (trip.total > 0 && trip.groups.length === 0) {
      content.push(
        <AllDone
          key="allDone"
          onUncheckAll={() => setConfirmAction('uncheckAll')}
        />,
      );
    }

    if (trip.checkedLines.length > 0) {
      content.push(
        <View
          key="checked"
          style={trip.groups.length > 0 && { marginTop: theme.spacing.md }}
        >
          <ListSection
            title="Checked"
            count={trip.checkedLines.length}
            collapsible
            collapsed={!checkedOpen}
            onCollapsedChange={(collapsed) => setCheckedOpen(!collapsed)}
          >
            {trip.checkedLines.map((line) => renderLine(line, true))}
          </ListSection>
          {checkedOpen && (
            <Text
              variant="caption"
              style={{
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
              }}
            >
              Tap a checked line to uncheck it.
            </Text>
          )}
        </View>,
      );
    }
  }

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
            { gap: theme.spacing.md, paddingHorizontal: theme.spacing.gutter },
          ]}
        >
          <OfflineBanner />
          <InlineNotice
            tone="destructive"
            message={describeVaultLoadError(loadError, 'this list')}
          />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void reload()}
          />
        </View>
      ) : trip === null ? (
        <View style={styles.centered}>
          <EmptyState
            icon="groceries"
            title="List not found"
            description="It may have been deleted on another device."
          />
        </View>
      ) : (
        <>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { paddingBottom: theme.spacing.lg },
            ]}
            stickyHeaderIndices={stickyIndices}
            showsVerticalScrollIndicator={false}
            contentOffset={rememberedScroll.contentOffset}
            scrollEventThrottle={rememberedScroll.scrollEventThrottle}
            onScroll={onScroll}
          >
            {content}
          </ScrollView>

          <GroceryFooterButton label="Add item" onPress={openAdd} />
        </>
      )}

      <Snackbar
        visible={deletedLine !== null}
        message={
          deletedLine === null ? '' : describeLineRemoved(deletedLine.name)
        }
        actionLabel="Undo"
        onAction={undoRemove}
        onDismiss={() => setDeletedLine(null)}
      />

      <AddToListSheet
        visible={addVisible}
        onDismiss={() => setAddVisible(false)}
        listName={trip?.name ?? ''}
        catalog={catalog}
        onListItemIds={onListItemIds}
        justAdded={justAdded}
        revertedReason={notice?.message}
        retryLabel={notice?.action}
        onRetry={retryLineEdit}
        busy={writing}
        onAddExisting={addExistingItem}
        onCreate={createItemAndAdd}
      />

      <MenuSheet
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        title={trip?.name}
        items={menuItems}
        footnote="The screen stays on only while this list is open."
      />

      <ConfirmSheet
        visible={confirmAction !== null}
        {...(confirmAction === null
          ? { title: '', message: '', confirmLabel: '' }
          : CONFIRM_COPY[confirmAction](checkedCount))}
        busy={confirmAction !== null && bulkPending === confirmAction}
        onConfirm={confirmBulkAction}
        onCancel={cancelBulkConfirm}
      />

      <TextPromptSheet
        visible={renameVisible}
        title="Rename list"
        label="List name"
        initialValue={trip?.name ?? ''}
        confirmLabel="Save"
        busy={bulkPending === 'rename'}
        onSubmit={submitRename}
        onCancel={cancelRename}
      />
    </Screen>
  );
}

/**
 * A line's amount, in its row's amount slot: an outlined control holding the
 * amount, or a dashed "Amount" when there is none (Groc-Trip). A separate
 * control from the row, so editing an amount never checks the line (#913).
 *
 * The row is one accessibility element, so this is drawn for sight and touch;
 * the row offers the same thing as its "Edit amount" / "Add an amount" action.
 */
function AmountButton({
  amount,
  disabled,
  onPress,
}: {
  amount: string | undefined;
  disabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const press = usePressFeedback();
  const focus = useFocusRing();
  const empty = amount == null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={empty ? 'Add an amount' : `Amount ${amount}, edit`}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      android_ripple={press.android_ripple}
      style={({ pressed }) => [
        styles.amount,
        empty ? styles.amountEmpty : null,
        {
          minHeight: MIN_TOUCH_TARGET,
          // The sheet pads the amount 12 each side, exactly between two
          // steps; a tie rounds up.
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderColor: theme.colors.controlEdge,
          backgroundColor: empty ? 'transparent' : theme.colors.card,
        },
        press.pressedStyle(pressed),
        focus.ringStyle,
        disabled && styles.disabled,
      ]}
    >
      <Text
        variant="bodySm"
        weight={empty ? 'medium' : 'semibold'}
        color={empty ? 'mutedForeground' : 'foreground'}
        numberOfLines={1}
        style={styles.figures}
      >
        {empty ? 'Amount' : amount}
      </Text>
    </Pressable>
  );
}

/** "Screen on" under the title while Keep screen on holds the screen awake. */
function ScreenOnPill(): React.JSX.Element {
  const theme = useTheme();
  // In dark the pill's `muted` fill sits almost on the page, so the design
  // edges it with `border` there, as it does every raised surface in dark.
  const edged = theme.mode === 'dark';

  return (
    <View
      style={[
        styles.pill,
        {
          // The sheet's 28pt pill, padded 8 before its glyph and 10 after
          // its label; 10 falls between two steps and takes the nearer.
          minHeight: 28,
          gap: theme.spacing.xs,
          paddingLeft: theme.spacing.sm,
          paddingRight: theme.spacing.sm,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.muted,
        },
        edged && { borderWidth: 1, borderColor: theme.colors.border },
      ]}
    >
      <Icon name="sun" size={14} />
      <Text variant="caption" weight="semibold" color="foreground">
        Screen on
      </Text>
    </View>
  );
}

/**
 * Every line checked (Groc-Trip-AllDone): a done mark and the way to reuse
 * the list. Uncheck All still asks first, exactly as it does from the menu.
 */
function AllDone({
  onUncheckAll,
}: {
  onUncheckAll: () => void;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.allDone,
        {
          gap: theme.spacing.md,
          paddingTop: theme.spacing.xl + theme.spacing.md,
          paddingBottom: theme.spacing.xl,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      <View style={[styles.doneTile, { borderRadius: theme.radii.xl }]}>
        {/* `success` at 12% — no role carries the tint, so the role is laid
            under the glyph at that opacity rather than mixed into a colour. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.doneWash,
            {
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.success,
            },
          ]}
        />
        <Icon name="check" size={30} color="success" />
      </View>
      <Text variant="title" accessibilityRole="header" style={styles.centred}>
        All done
      </Text>
      <Text variant="bodySm" color="mutedForeground" style={styles.centred}>
        Uncheck All to reuse this list.
      </Text>
      <Button
        label="Uncheck All"
        variant="secondary"
        onPress={onUncheckAll}
        style={styles.hug}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grow: {
    flexGrow: 1,
  },
  figures: {
    fontVariant: ['tabular-nums'],
  },
  amount: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  amountEmpty: {
    borderStyle: 'dashed',
  },
  amountSlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  amountField: {
    width: AMOUNT_FIELD_WIDTH,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allDone: {
    alignItems: 'center',
  },
  // The sheet's 56pt done tile, the same size as the empty state's.
  doneTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneWash: {
    opacity: 0.12,
  },
  centred: {
    textAlign: 'center',
  },
  hug: {
    alignSelf: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
