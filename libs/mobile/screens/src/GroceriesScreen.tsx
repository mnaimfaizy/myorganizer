import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  newRecordId,
  useUnconfirmedEdit,
  useVaultBlob,
  VAULT_WRITE_ERROR_COPY,
} from '@myorganizer/mobile/feat-vault';
import {
  createGroceryList,
  deleteGroceryList,
  renameGroceryList,
  type GroceryList,
} from '@myorganizer/vault-core/portable';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  InlineNotice,
  ListRow,
  ListSection,
  MenuSheet,
  OfflineBanner,
  Screen,
  Text,
  TextPromptSheet,
  useLargeTitleCollapse,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import { GroceryFooterButton } from './GroceryFooterButton';
import { GroceryProgressBar } from './GroceryProgressBar';
import {
  GROCERIES_ROUTES,
  type GroceriesStackParamList,
} from './groceriesStack';
import {
  checkedFraction,
  describeDeleteList,
  describeListProgress,
  readGroceryListSummaries,
  type GroceryListSummary,
} from './groceryTripModel';
import { TAB_SCREEN_EDGES, TabScreenHeader } from './TabScreenHeader';
import { describeVaultLoadError } from './vaultLoadError';
import { useRememberedScroll } from './useRememberedScroll';

/** The list a Rename, Delete, or press-and-hold menu is about. */
interface ListTarget {
  id: string;
  name: string;
  /** Every line on it — what its Delete confirmation says goes with it. */
  lines: number;
}

/**
 * The Grocery Lists: every list in the Vault with how much of it is left, the
 * way into a trip, and — as of #914 — the way to create, rename, and delete
 * one. Catalog editing and Delete From Catalog stay web-only; this screen
 * touches `lists` only.
 */
export function GroceriesScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<GroceriesStackParamList>>();
  const rememberedScroll = useRememberedScroll('Groceries');
  const titleCollapse = useLargeTitleCollapse();
  const {
    snapshot,
    loading,
    refreshing,
    loadError,
    writeError,
    reload,
    apply,
    retry,
  } = useVaultBlob(VaultBlobType.Groceries);

  const lists = useMemo(
    () => readGroceryListSummaries(snapshot?.envelope.records),
    [snapshot],
  );

  // The same Unconfirmed Edit shape the trip view uses for a line, one level
  // up for an edit to a Grocery List itself.
  const {
    pendingId: pendingListId,
    revertedId: revertedListId,
    push,
    reloadAfterConflict,
    retryFailedEdit,
  } = useUnconfirmedEdit(apply, retry, reload);
  const [createVisible, setCreateVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ListTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListTarget | null>(null);
  const [menuTarget, setMenuTarget] = useState<ListTarget | null>(null);

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

  const createList = useCallback(
    (name: string): void => {
      const now = new Date().toISOString();
      const list: GroceryList = {
        id: newRecordId(),
        name,
        lines: [],
        createdAt: now,
        updatedAt: now,
      };
      void push(list.id, (envelope) => createGroceryList(envelope, list)).then(
        () => setCreateVisible(false),
      );
    },
    [push],
  );

  const submitRename = useCallback(
    (name: string): void => {
      if (renameTarget === null) return;
      const { id } = renameTarget;
      const now = new Date().toISOString();
      void push(id, (envelope) =>
        renameGroceryList(envelope, id, name, now),
      ).then(() => setRenameTarget(null));
    },
    [push, renameTarget],
  );

  const confirmDelete = useCallback((): void => {
    if (deleteTarget === null) return;
    const { id } = deleteTarget;
    const now = new Date().toISOString();
    void push(id, (envelope) => deleteGroceryList(envelope, id, now)).then(() =>
      setDeleteTarget(null),
    );
  }, [push, deleteTarget]);

  const cancelCreate = useCallback((): void => {
    if (pendingListId !== null) return;
    setCreateVisible(false);
  }, [pendingListId]);

  const cancelRename = useCallback((): void => {
    if (pendingListId !== null) return;
    setRenameTarget(null);
  }, [pendingListId]);

  const cancelDelete = useCallback((): void => {
    if (pendingListId !== null) return;
    setDeleteTarget(null);
  }, [pendingListId]);

  const openCreate = useCallback((): void => setCreateVisible(true), []);

  const rowState = (id: string): ListRowState =>
    pendingListId === id
      ? 'unconfirmed'
      : revertedListId === id && writeError != null
        ? 'reverted'
        : 'normal';

  const notice = writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];

  const renderRow = (item: GroceryListSummary): React.JSX.Element => {
    const target: ListTarget = {
      id: item.id,
      name: item.name,
      lines: item.total,
    };
    const progress = describeListProgress(item.remaining, item.total);

    return (
      <ListRow
        key={item.id}
        title={item.name}
        titleWeight="semibold"
        subtitle={progress}
        subtitleAccessory={
          <GroceryProgressBar
            size="mini"
            fraction={checkedFraction(item.remaining, item.total)}
          />
        }
        chevron
        onPress={() =>
          navigation.navigate(GROCERIES_ROUTES.trip, { listId: item.id })
        }
        onLongPress={() => setMenuTarget(target)}
        innerActions={[
          {
            id: 'rename',
            label: 'Rename list',
            onPress: () => setRenameTarget(target),
          },
        ]}
        rightActions={[
          {
            id: 'delete',
            label: 'Delete',
            icon: 'trash',
            tone: 'destructive',
            onPress: () => setDeleteTarget(target),
          },
        ]}
        state={rowState(item.id)}
        revertedReason={notice?.message}
        retryLabel={notice?.action}
        onRetry={
          writeError === 'conflict' ? reloadAfterConflict : retryFailedEdit
        }
      />
    );
  };

  // A created list that never reached the server was only ever shown
  // optimistically, so a failed push leaves no row to put the reason under —
  // the same reasoning as the trip view's own `revertedOffScreen`.
  const revertedOffScreen =
    writeError != null &&
    revertedListId !== null &&
    !lists.some((list) => list.id === revertedListId);

  return (
    <Screen edges={TAB_SCREEN_EDGES} noPadding>
      <TabScreenHeader title="Groceries" collapsed={titleCollapse.collapsed} />

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
            message={describeVaultLoadError(loadError, 'your grocery lists')}
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
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            // The strip stays under the header while the lists scroll.
            stickyHeaderIndices={[0]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void reload()}
                tintColor={theme.colors.mutedForeground}
                colors={[theme.colors.primary]}
              />
            }
            contentOffset={rememberedScroll.contentOffset}
            scrollEventThrottle={rememberedScroll.scrollEventThrottle}
            onScroll={onScroll}
          >
            <View>
              <OfflineBanner />
              {revertedOffScreen && notice != null && (
                <InlineNotice
                  tone="destructive"
                  message={notice.message}
                  actionLabel={notice.action}
                  onAction={() =>
                    void (writeError === 'conflict'
                      ? reloadAfterConflict()
                      : retryFailedEdit())
                  }
                  style={{
                    marginHorizontal: theme.spacing.md,
                    marginTop: theme.spacing.sm,
                  }}
                />
              )}
            </View>

            {lists.length === 0 ? (
              <EmptyState
                icon="groceries"
                title="No Grocery Lists yet"
                description="Make one for your next shop."
              />
            ) : (
              <View>
                <ListSection title="Your lists" count={lists.length}>
                  {lists.map(renderRow)}
                </ListSection>
                <Text
                  variant="caption"
                  style={{
                    // The sheet pads the hint 10 by 16; 10 falls between the
                    // `sm` and `md` steps and takes the nearer, `sm`.
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                  }}
                >
                  Press and hold a list to rename or delete it.
                </Text>
              </View>
            )}
          </ScrollView>

          <GroceryFooterButton label="New list" onPress={openCreate} />
        </>
      )}

      <TextPromptSheet
        visible={createVisible}
        title="New list"
        label="List name"
        confirmLabel="Create list"
        busy={createVisible && pendingListId !== null}
        onSubmit={createList}
        onCancel={cancelCreate}
      />

      <MenuSheet
        visible={menuTarget !== null}
        onDismiss={() => setMenuTarget(null)}
        title={menuTarget?.name}
        items={[
          {
            id: 'rename',
            label: 'Rename list',
            icon: 'pencil',
            onPress: () => {
              if (menuTarget !== null) setRenameTarget(menuTarget);
            },
          },
          {
            id: 'delete',
            label: 'Delete list',
            icon: 'trash',
            destructive: true,
            onPress: () => {
              if (menuTarget !== null) setDeleteTarget(menuTarget);
            },
          },
        ]}
      />

      <TextPromptSheet
        visible={renameTarget !== null}
        title="Rename list"
        label="List name"
        initialValue={renameTarget?.name ?? ''}
        confirmLabel="Save"
        busy={renameTarget !== null && pendingListId === renameTarget.id}
        onSubmit={submitRename}
        onCancel={cancelRename}
      />

      <ConfirmSheet
        visible={deleteTarget !== null}
        title={deleteTarget === null ? '' : `Delete “${deleteTarget.name}”?`}
        message={
          deleteTarget === null ? '' : describeDeleteList(deleteTarget.lines)
        }
        confirmLabel="Delete list"
        destructive
        busy={deleteTarget !== null && pendingListId === deleteTarget.id}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
