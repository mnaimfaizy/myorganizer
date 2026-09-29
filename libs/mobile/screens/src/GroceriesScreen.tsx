import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VaultBlobType } from '@myorganizer/app-api-client';
import { useVaultBlob } from '@myorganizer/mobile/feat-vault';
import {
  Button,
  EmptyState,
  Icon,
  InlineNotice,
  ListRow,
  OfflineBanner,
  Screen,
  useTheme,
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

/**
 * The Grocery Lists: every list in the Vault with how much of it is left,
 * and the way into a trip.
 *
 * Read-only on purpose — this slice makes a list shoppable, not creatable, so
 * a list is still made on the web and shopped here. Everything that edits a
 * Grocery List lives one screen in, on the trip view.
 */
export function GroceriesScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<GroceriesStackParamList>>();
  const rememberedScroll = useRememberedScroll('Groceries');
  const { snapshot, loading, refreshing, loadError, reload } = useVaultBlob(
    VaultBlobType.Groceries,
  );

  const lists = useMemo(
    () => readGroceryListSummaries(snapshot?.envelope.records),
    [snapshot],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GroceryListSummary>): React.JSX.Element => (
      <ListRow
        title={item.name}
        subtitle={describeRemaining(item.remaining, item.total)}
        onPress={() =>
          navigation.navigate(GROCERIES_ROUTES.trip, { listId: item.id })
        }
        trailing={
          <Icon name="chevronRight" size={20} color="mutedForeground" />
        }
        style={[styles.row, { borderRadius: theme.radii.md }]}
      />
    ),
    [navigation, theme],
  );

  return (
    <Screen edges={TAB_SCREEN_EDGES}>
      <TabScreenHeader title="Groceries" />

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
            <View style={{ marginBottom: theme.spacing.sm }}>
              <OfflineBanner />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="groceries"
              title="No grocery lists yet"
              description="Create one on the web, then shop it here."
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
