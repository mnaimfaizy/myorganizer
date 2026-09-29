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
  newRecordId,
  usePendingVaultEdit,
  useVaultBlob,
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
  IconButton,
  InlineNotice,
  ListRow,
  ListSection,
  MenuSheet,
  OfflineBanner,
  Screen,
  Snackbar,
  Text,
  TextField,
  TextPromptSheet,
  haptics,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import { AddToListSheet } from './AddToListSheet';
import {
  GROCERIES_ROUTES,
  type GroceriesStackParamList,
} from './groceriesStack';
import {
  buildTripView,
  catalogItemIdsOnList,
  describeRemaining,
  readCatalogEntries,
  type TripLine,
} from './groceryTripModel';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';
import { useRememberedScroll } from './useRememberedScroll';
import type { CatalogEntry } from './groceryTripModel';

/** Which list-level menu action, if any, is mid-flight or reverted. */
type BulkAction = 'uncheckAll' | 'removeChecked' | 'rename';

/**
 * What each ConfirmSheet-gated menu action says it will do. Rename opens its
 * own `TextPromptSheet` instead and carries no entry here.
 */
const CONFIRM_COPY = {
  uncheckAll: {
    title: 'Uncheck All',
    message: 'Unchecks every checked item on this list. Nothing is removed.',
    confirmLabel: 'Uncheck All',
  },
  removeChecked: {
    title: 'Remove Checked From List',
    message:
      "Removes every checked item from this list. It stays in the Catalog and can be added to a list again — it isn't deleted.",
    confirmLabel: 'Remove',
  },
} as const satisfies Record<
  'uncheckAll' | 'removeChecked',
  { title: string; message: string; confirmLabel: string }
>;

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
  const rememberedScroll = useRememberedScroll(`GroceryTrip:${listId}`);

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

  const trip = useMemo(
    () => buildTripView(snapshot?.envelope.records, listId),
    [snapshot, listId],
  );

  // Which line the screen is showing an Unconfirmed Edit for, and which one
  // was put back when a push failed.
  const {
    pendingId: unconfirmedLineId,
    revertedId: revertedLineId,
    push,
    reloadAfterConflict,
    retryFailedEdit,
  } = usePendingVaultEdit(apply, retry, reload);
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
  } = usePendingVaultEdit<BulkAction>(apply, retry, reload);

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
  // What Undo would put back. Held only while the Snackbar is up, and never
  // written anywhere: an Undo that outlives the screen is an edit in a queue,
  // which mobile does not keep (ADR 0107).
  const [deletedLine, setDeletedLine] = useState<TripLine | null>(null);

  // The Add-to-list sheet, the trip view's own "⋯" menu, and the sheets that
  // menu opens.
  const [addVisible, setAddVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  // The ConfirmSheet-gated action being asked about — Rename has no
  // confirmation step, so it is not one of these.
  const [confirmAction, setConfirmAction] = useState<
    'uncheckAll' | 'removeChecked' | null
  >(null);

  const catalog = useMemo(
    () => readCatalogEntries(snapshot?.envelope.records),
    [snapshot],
  );
  const onListItemIds = useMemo(
    () => catalogItemIdsOnList(snapshot?.envelope.records, listId),
    [snapshot, listId],
  );

  const openMenu = useCallback((): void => setMenuVisible(true), []);

  const menuItems = useMemo(
    () => [
      {
        id: 'uncheckAll',
        label: 'Uncheck All',
        onPress: () => setConfirmAction('uncheckAll'),
      },
      {
        id: 'removeChecked',
        label: 'Remove Checked From List',
        destructive: true,
        onPress: () => setConfirmAction('removeChecked'),
      },
      {
        id: 'rename',
        label: 'Rename list',
        onPress: () => setRenameVisible(true),
      },
    ],
    [],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: trip?.name ?? 'Trip',
      headerRight: () => (
        <View style={[styles.headerActions, { gap: theme.spacing.xs }]}>
          <IconButton
            icon="plus"
            accessibilityLabel="Add to list"
            onPress={() => setAddVisible(true)}
          />
          <IconButton
            icon="more"
            accessibilityLabel="List menu"
            onPress={openMenu}
          />
        </View>
      ),
    });
  }, [navigation, trip?.name, openMenu, theme.spacing.xs]);

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
      void push(line.id, (envelope) =>
        createCatalogItemAndAddLine(envelope, listId, item, line),
      );
    },
    [push, listId],
  );

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
      const now = new Date().toISOString();
      void push(line.id, (envelope) =>
        setListLineChecked(envelope, listId, line.id, !line.checked, now),
      );
    },
    [push, listId],
  );

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

  const renderLine = (line: TripLine): React.JSX.Element => {
    const notice =
      writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
    const editing = editingLineId === line.id;

    return (
      <View key={line.id}>
        <ListRow
          title={line.name}
          size="comfortable"
          checked={line.checked}
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
          trailing={
            <Button
              label={line.amount ?? 'Amount'}
              variant="ghost"
              disabled={writing}
              accessibilityLabel={`Edit amount for ${line.name}`}
              onPress={() => beginAmountEdit(line)}
            />
          }
          // The amount button is drawn inside the row, and a row is one
          // accessibility element — so the button is not reachable on its own
          // and the row offers it as an action instead.
          innerActions={[
            {
              id: 'amount',
              label: 'Edit amount',
              onPress: () => beginAmountEdit(line),
            },
          ]}
          rightActions={[
            {
              id: 'delete',
              label: 'Delete',
              icon: 'close',
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
          onRetry={
            writeError === 'conflict' ? reloadAfterConflict : retryFailedEdit
          }
          style={[styles.row, { borderRadius: theme.radii.md }]}
        />

        {/* Under the row rather than in it. The row is one accessibility
            element, so a field drawn inside it is one a screen reader cannot
            move into — it would be an amount only a sighted User could edit.
            Full width rather than a fixed one, so it still holds a value at
            200% text size. */}
        {editing && (
          <TextField
            label={`Amount for ${line.name}`}
            value={amountDraft}
            onChangeText={setAmountDraft}
            onBlur={() => commitAmount(line)}
            onSubmitEditing={() => commitAmount(line)}
            returnKeyType="done"
            autoFocus
            placeholder="e.g. 2, 500g, 1 dozen"
            containerStyle={{ marginTop: theme.spacing.xs }}
          />
        )}
      </View>
    );
  };

  // An Undo re-adds under a *fresh* line id, so a refused Undo reverts to a
  // copy that holds no line with that id and there is no row to put the
  // reason under. Without this the Undo simply vanishes and the User is never
  // told it failed.
  const revertedOffScreen =
    writeError != null &&
    revertedLineId !== null &&
    trip !== null &&
    ![
      ...trip.groups.flatMap((group) => group.lines),
      ...trip.checkedLines,
    ].some((line) => line.id === revertedLineId);

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
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { gap: theme.spacing.md, paddingBottom: theme.spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          {...rememberedScroll}
        >
          <OfflineBanner />
          <Text variant="labelCaps">
            {describeRemaining(trip.remaining, trip.total)}
          </Text>

          {revertedOffScreen && writeError != null && (
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

          {bulkReverted != null && writeError != null && (
            <InlineNotice
              tone="destructive"
              message={VAULT_WRITE_ERROR_COPY[writeError].message}
              actionLabel={VAULT_WRITE_ERROR_COPY[writeError].action}
              onAction={() =>
                void (writeError === 'conflict'
                  ? reloadAfterBulkConflict()
                  : retryBulkAction())
              }
            />
          )}

          {trip.total === 0 && (
            <EmptyState
              icon="groceries"
              title="Nothing on this list"
              description="Add items to it on the web, then shop them here."
            />
          )}

          {trip.groups.map((group) => (
            <ListSection
              key={group.category}
              title={group.label}
              meta={`${group.lines.length}`}
              style={{ gap: theme.spacing.sm }}
            >
              {group.lines.map(renderLine)}
            </ListSection>
          ))}

          {trip.checkedLines.length > 0 && (
            <ListSection
              title={`Checked (${trip.checkedLines.length})`}
              collapsible
              defaultCollapsed
              style={{ gap: theme.spacing.sm }}
            >
              {trip.checkedLines.map(renderLine)}
            </ListSection>
          )}
        </ScrollView>
      )}

      <Snackbar
        visible={deletedLine !== null}
        message={deletedLine === null ? '' : `Removed ${deletedLine.name}`}
        actionLabel="Undo"
        onAction={undoRemove}
        onDismiss={() => setDeletedLine(null)}
      />

      <AddToListSheet
        visible={addVisible}
        onDismiss={() => setAddVisible(false)}
        catalog={catalog}
        onListItemIds={onListItemIds}
        onAddExisting={addExistingItem}
        onCreate={createItemAndAdd}
      />

      <MenuSheet
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        title="List menu"
        items={menuItems}
      />

      <ConfirmSheet
        visible={confirmAction !== null}
        title={confirmAction === null ? '' : CONFIRM_COPY[confirmAction].title}
        message={
          confirmAction === null ? '' : CONFIRM_COPY[confirmAction].message
        }
        confirmLabel={
          confirmAction === null ? '' : CONFIRM_COPY[confirmAction].confirmLabel
        }
        destructive={confirmAction === 'removeChecked'}
        busy={confirmAction !== null && bulkPending === confirmAction}
        onConfirm={confirmBulkAction}
        onCancel={cancelBulkConfirm}
      />

      <TextPromptSheet
        visible={renameVisible}
        title="Rename list"
        label="List name"
        initialValue={trip?.name ?? ''}
        confirmLabel="Rename"
        busy={bulkPending === 'rename'}
        onSubmit={submitRename}
        onCancel={cancelRename}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },
  // Clips the swipe panels to the row's own corners; the radius itself is a
  // theme value and is merged in per render.
  row: {
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
