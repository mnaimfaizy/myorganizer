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
  useVaultBlob,
  type VaultBlobEdit,
  type VaultBlobWriteErrorKind,
} from '@myorganizer/mobile/feat-vault';
import {
  deleteListLine,
  putListLine,
  setListLineAmount,
  setListLineChecked,
  type ListLine,
} from '@myorganizer/vault-core/portable';
import {
  Button,
  Checkbox,
  EmptyState,
  InlineNotice,
  ListRow,
  ListSection,
  OfflineBanner,
  Screen,
  Snackbar,
  Text,
  TextField,
  haptics,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import {
  GROCERIES_ROUTES,
  type GroceriesStackParamList,
} from './groceriesStack';
import {
  buildTripView,
  describeRemaining,
  type TripLine,
} from './groceryTripModel';
import { STACK_SCREEN_EDGES } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';
import { useRememberedScroll } from './useRememberedScroll';

/**
 * What a refused push says, and what it offers instead.
 *
 * Groceries is pinned to `promptOnConflict`, so a conflict is **not** retried:
 * re-applying this edit to a newer copy would apply it to lines this User has
 * not seen (ADR 0107 decision 4). The way forward is to look, which is why
 * the offer is Reload and not Retry — the other two are ordinary failures and
 * resend the same edit.
 */
const WRITE_ERROR = {
  conflict: {
    message: 'Changed on another device. Reload to see the latest.',
    action: 'Reload',
  },
  network: {
    message: 'Your change was not saved — check your connection and try again.',
    action: 'Retry',
  },
  failed: {
    message: 'Your change was not saved. Please try again.',
    action: 'Retry',
  },
} as const satisfies Record<
  VaultBlobWriteErrorKind,
  { message: string; action: string }
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
  // was put back when a push failed. One of each: the hook runs one write at
  // a time, so there is never a second line waiting.
  const [unconfirmedLineId, setUnconfirmedLineId] = useState<string | null>(
    null,
  );
  const [revertedLineId, setRevertedLineId] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState('');
  // What Undo would put back. Held only while the Snackbar is up, and never
  // written anywhere: an Undo that outlives the screen is an edit in a queue,
  // which mobile does not keep (ADR 0107).
  const [deletedLine, setDeletedLine] = useState<TripLine | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: trip?.name ?? 'Trip' });
  }, [navigation, trip?.name]);

  const push = useCallback(
    async (lineId: string, edit: VaultBlobEdit): Promise<boolean> => {
      setUnconfirmedLineId(lineId);
      setRevertedLineId(null);
      const confirmed = await apply(edit);
      setUnconfirmedLineId(null);
      if (!confirmed) setRevertedLineId(lineId);
      return confirmed;
    },
    [apply],
  );

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

  const reloadAfterConflict = useCallback((): void => {
    setRevertedLineId(null);
    void reload();
  }, [reload]);

  const retryFailedEdit = useCallback(async (): Promise<void> => {
    const lineId = revertedLineId;
    setUnconfirmedLineId(lineId);
    const confirmed = await retry();
    setUnconfirmedLineId(null);
    if (confirmed) setRevertedLineId(null);
  }, [retry, revertedLineId]);

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
    const notice = writeError == null ? null : WRITE_ERROR[writeError];
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
              message={WRITE_ERROR[writeError].message}
              actionLabel={WRITE_ERROR[writeError].action}
              onAction={() =>
                void (writeError === 'conflict'
                  ? reloadAfterConflict()
                  : retryFailedEdit())
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
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
