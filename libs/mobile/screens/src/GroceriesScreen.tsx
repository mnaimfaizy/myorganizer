import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import {
  newRecordId,
  usePendingVaultEdit,
  useVaultBlob,
  useVaultSession,
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
  Icon,
  IconButton,
  InlineNotice,
  ListRow,
  LockAction,
  MenuSheet,
  OfflineBanner,
  Screen,
  TextPromptSheet,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import {
  GROCERIES_ROUTES,
  type GroceriesStackParamList,
} from './groceriesStack';
import {
  describeRemaining,
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
  const { lock } = useVaultSession();
  const rememberedScroll = useRememberedScroll('Groceries');
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
  } = usePendingVaultEdit(apply, retry, reload);
  const [createVisible, setCreateVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ListTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListTarget | null>(null);
  const [menuTarget, setMenuTarget] = useState<ListTarget | null>(null);

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

  useLayoutEffect(() => {
    if (Platform.OS !== 'ios') return;
    navigation.setOptions({
      headerRight: () => (
        <View style={[styles.headerActions, { gap: theme.spacing.xs }]}>
          <IconButton
            icon="plus"
            accessibilityLabel="New list"
            onPress={openCreate}
          />
          <LockAction onPress={() => lock('manual')} />
        </View>
      ),
    });
  }, [navigation, openCreate, lock, theme.spacing.xs]);

  const rowState = (id: string): ListRowState =>
    pendingListId === id
      ? 'unconfirmed'
      : revertedListId === id && writeError != null
        ? 'reverted'
        : 'normal';

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GroceryListSummary>): React.JSX.Element => {
      const notice =
        writeError == null ? null : VAULT_WRITE_ERROR_COPY[writeError];
      const target: ListTarget = { id: item.id, name: item.name };

      return (
        <ListRow
          title={item.name}
          subtitle={describeRemaining(item.remaining, item.total)}
          onPress={() =>
            navigation.navigate(GROCERIES_ROUTES.trip, { listId: item.id })
          }
          onLongPress={() => setMenuTarget(target)}
          trailing={
            <Icon name="chevronRight" size={20} color="mutedForeground" />
          }
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
              label: 'Delete list',
              icon: 'close',
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
          style={[styles.row, { borderRadius: theme.radii.md }]}
        />
      );
    },
    [
      navigation,
      theme,
      writeError,
      pendingListId,
      revertedListId,
      reloadAfterConflict,
      retryFailedEdit,
    ],
  );

  // A created list that never reached the server was only ever shown
  // optimistically, so a failed push leaves no row to put the reason under —
  // the same reasoning as the trip view's own `revertedOffScreen`.
  const revertedOffScreen =
    writeError != null &&
    revertedListId !== null &&
    !lists.some((list) => list.id === revertedListId);

  return (
    <Screen edges={TAB_SCREEN_EDGES}>
      <TabScreenHeader
        title="Groceries"
        trailing={
          <IconButton
            icon="plus"
            accessibilityLabel="New list"
            onPress={openCreate}
          />
        }
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError != null ? (
        <View style={[styles.centered, { gap: theme.spacing.md }]}>
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
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={() => void reload()}
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={
            <View
              style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}
            >
              <OfflineBanner />
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
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="groceries"
              title="No grocery lists yet"
              description="Create one to start shopping."
            />
          }
          contentContainerStyle={[
            styles.listContent,
            { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          {...rememberedScroll}
        />
      )}

      <TextPromptSheet
        visible={createVisible}
        title="New list"
        label="List name"
        placeholder="e.g. Weekly shop"
        confirmLabel="Create"
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
            onPress: () => {
              if (menuTarget !== null) setRenameTarget(menuTarget);
            },
          },
          {
            id: 'delete',
            label: 'Delete list',
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
        confirmLabel="Rename"
        busy={renameTarget !== null && pendingListId === renameTarget.id}
        onSubmit={submitRename}
        onCancel={cancelRename}
      />

      <ConfirmSheet
        visible={deleteTarget !== null}
        title="Delete list"
        message={
          deleteTarget === null
            ? ''
            : `Delete "${deleteTarget.name}"? This can't be undone. Its Catalog Items are not deleted.`
        }
        confirmLabel="Delete"
        destructive
        busy={deleteTarget !== null && pendingListId === deleteTarget.id}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
  },
  // Clips the swipe panels to the row's own corners; the radius itself is a
  // theme value and is merged in per render.
  row: {
    overflow: 'hidden',
  },
  listContent: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
