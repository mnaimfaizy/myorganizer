import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  GROCERY_CATEGORY_ORDER,
  groceryCategoryLabel,
  type GroceryCategoryType,
} from '@myorganizer/vault-core/portable';
import {
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  ListRow,
  ListSectionRows,
  Text,
  TextField,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import type { CatalogEntry } from './groceryTripModel';

/** The line this sheet last added, and where its Vault Push has got to. */
export interface JustAddedLine {
  name: string;
  category: GroceryCategoryType;
  /** The line's Unconfirmed Edit state, exactly as its trip row would show it. */
  state: ListRowState;
}

export interface AddToListSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** The Grocery List being added to — the sheet is titled "Add to <name>". */
  listName: string;
  /** Every Catalog Item, for the type-ahead to search over. */
  catalog: readonly CatalogEntry[];
  /** Catalog Item ids already on this list — shown as "On this list" and inert. */
  onListItemIds: ReadonlySet<string>;
  /** The line added last from this sheet, or `null` before the first. */
  justAdded: JustAddedLine | null;
  /** Why `justAdded` was put back, when its state is `reverted`. */
  revertedReason?: string;
  /** What the way forward is called — `Retry`, or `Reload` for a conflict. */
  retryLabel?: string;
  onRetry?: () => void;
  /**
   * A Vault Push is in flight. Adding waits for it: one write runs at a time,
   * and a second tap would be refused without a word.
   */
  busy?: boolean;
  /** An existing Catalog Item was chosen. The sheet stays open. */
  onAddExisting: (item: CatalogEntry) => void;
  /** A new Catalog Item is wanted. The sheet stays open. */
  onCreate: (name: string, category: GroceryCategoryType) => void;
}

/** How many matches the type-ahead shows at once. */
const MAX_MATCHES = 20;

/** The results' visible height before they scroll inside the sheet. */
const RESULTS_MAX_HEIGHT = 360;

/**
 * Type-ahead over the Catalog, for adding to one Grocery List (#914).
 *
 * Adding keeps the sheet open (Groc-Add-Added): the field clears, the line
 * just added shows under "Just added" with its own Unconfirmed Edit state —
 * "Saving…", then "Added", or the reason and Retry if it did not reach the
 * server — and the User types the next thing. Creating a new Catalog Item
 * steps to a category picker first, then comes back here the same way.
 */
export function AddToListSheet({
  visible,
  onDismiss,
  listName,
  catalog,
  onListItemIds,
  justAdded,
  revertedReason,
  retryLabel,
  onRetry,
  busy = false,
  onAddExisting,
  onCreate,
}: AddToListSheetProps): React.JSX.Element {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<'search' | 'category'>('search');
  const [category, setCategory] = useState<GroceryCategoryType>('other');

  // Reset on every opening, so a sheet reopened later does not still show the
  // last search or sit on the category step.
  useEffect(() => {
    if (visible) {
      setQuery('');
      setStep('search');
      setCategory('other');
    }
  }, [visible]);

  const trimmedQuery = query.trim();

  const matches = useMemo(() => {
    if (trimmedQuery.length === 0) return catalog.slice(0, MAX_MATCHES);
    const needle = trimmedQuery.toLowerCase();
    return catalog
      .filter((item) => item.name.toLowerCase().includes(needle))
      .slice(0, MAX_MATCHES);
  }, [catalog, trimmedQuery]);

  const hasExactMatch = useMemo(
    () =>
      catalog.some(
        (item) => item.name.toLowerCase() === trimmedQuery.toLowerCase(),
      ),
    [catalog, trimmedQuery],
  );

  const handleAddExisting = (item: CatalogEntry): void => {
    onAddExisting(item);
    setQuery('');
  };

  const handleCreate = (): void => {
    onCreate(trimmedQuery, category);
    setQuery('');
    setCategory('other');
    setStep('search');
  };

  // What was just added shows in place of the results once the field has
  // cleared — and stays up over a new search if it did not save, so the
  // reason and Retry are never typed away.
  const showJustAdded =
    justAdded !== null &&
    (trimmedQuery.length === 0 || justAdded.state === 'reverted');
  const showResults = !showJustAdded || trimmedQuery.length > 0;
  const canCreate = trimmedQuery.length > 0 && !hasExactMatch;
  const bleed = { marginHorizontal: -theme.spacing.md };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title={step === 'search' ? `Add to ${listName}` : undefined}
      showClose={step === 'search'}
    >
      {step === 'search' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <TextField
            icon="search"
            placeholder="Search your Catalog"
            accessibilityLabel="Search your Catalog"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />

          {showJustAdded && justAdded !== null && (
            <View style={[bleed, { gap: theme.spacing.xs }]}>
              <Text
                variant="labelCaps"
                color="foreground"
                accessibilityRole="header"
                style={{ paddingHorizontal: theme.spacing.md }}
              >
                Just added
              </Text>
              <View>
                <ListRow
                  title={justAdded.name}
                  subtitle={groceryCategoryLabel(justAdded.category)}
                  trailing={
                    justAdded.state === 'normal' ? (
                      <StatusMark label="Added" />
                    ) : null
                  }
                  accessibilityLabel={
                    justAdded.state === 'normal'
                      ? `${justAdded.name}, added`
                      : justAdded.name
                  }
                  state={justAdded.state}
                  revertedReason={revertedReason}
                  retryLabel={retryLabel}
                  onRetry={onRetry}
                />
                {justAdded.state === 'normal' && (
                  // The design washes the confirmed row in `success` at 8%.
                  // No role carries that tint, so the role is laid over the
                  // row at that opacity rather than mixed into a new colour.
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      styles.addedWash,
                      { backgroundColor: theme.colors.success },
                    ]}
                  />
                )}
              </View>
              <Text
                variant="caption"
                color="foreground"
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                }}
              >
                The field clears so you can add the next thing.
              </Text>
            </View>
          )}

          {showResults && (
            <ScrollView
              style={[styles.results, bleed]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {matches.length === 0 && !canCreate && justAdded === null ? (
                <EmptyState
                  icon="groceries"
                  title="Your Catalog is empty"
                  description="Type a name to create the first item."
                />
              ) : (
                <ListSectionRows>
                  {matches.map((item) => {
                    const onList = onListItemIds.has(item.id);
                    return (
                      <ListRow
                        key={item.id}
                        title={item.name}
                        subtitle={groceryCategoryLabel(item.category)}
                        trailing={
                          onList ? (
                            <StatusMark label="On this list" />
                          ) : (
                            <AddMark />
                          )
                        }
                        accessibilityLabel={
                          onList
                            ? `${item.name}, on this list`
                            : `Add ${item.name}`
                        }
                        disabled={!onList && busy}
                        onPress={
                          onList ? undefined : () => handleAddExisting(item)
                        }
                      />
                    );
                  })}
                  {canCreate && (
                    <ListRow
                      key="create"
                      title={`Create “${trimmedQuery}”`}
                      titleWeight="semibold"
                      leading={<CreateTile />}
                      onPress={() => setStep('category')}
                    />
                  )}
                </ListSectionRows>
              )}
            </ScrollView>
          )}
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Button
            label="Results"
            variant="ghost"
            size="compact"
            icon="chevronLeft"
            onPress={() => setStep('search')}
            style={{
              ...styles.back,
              paddingHorizontal: theme.spacing.xs,
            }}
          />
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="title" accessibilityRole="header">
              {`Create “${trimmedQuery}”`}
            </Text>
            <Text variant="bodySm" color="foreground">
              Pick a category. It joins this list, and your Catalog keeps it for
              next time.
            </Text>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Category"
            style={[styles.chips, { gap: theme.spacing.sm }]}
          >
            {GROCERY_CATEGORY_ORDER.map((option) => (
              <Chip
                key={option}
                label={groceryCategoryLabel(option)}
                icon="tag"
                accessibilityRole="radio"
                selected={category === option}
                onPress={() => setCategory(option)}
              />
            ))}
          </View>
          <Button
            label="Add to list"
            icon="plus"
            size="large"
            disabled={busy}
            onPress={handleCreate}
          />
        </View>
      )}
    </BottomSheet>
  );
}

/** A check in `success` and a short word — "On this list", "Added". */
function StatusMark({ label }: { label: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <View style={[styles.inline, { gap: theme.spacing.xs }]}>
      <Icon name="check" size={18} color="success" />
      <Text variant="caption" weight="semibold" color="foreground">
        {label}
      </Text>
    </View>
  );
}

/**
 * The outlined plus a result row ends in. Drawn for sight only: the whole row
 * is the add target, and the row is one accessibility element named "Add …".
 */
function AddMark(): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.mark,
        {
          borderRadius: theme.radii.md,
          borderColor: theme.colors.controlEdge,
        },
      ]}
    >
      <Icon name="plus" size={20} />
    </View>
  );
}

/** The Create row's filled tile, in `primary` as the sheet draws it. */
function CreateTile(): React.JSX.Element {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.tile,
        {
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.primary,
        },
      ]}
    >
      <Icon name="plus" size={18} color="primaryForeground" />
    </View>
  );
}

const styles = StyleSheet.create({
  results: {
    maxHeight: RESULTS_MAX_HEIGHT,
  },
  addedWash: {
    opacity: 0.08,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  back: {
    alignSelf: 'flex-start',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The sheet's 44pt add box and 32pt create tile: component dimensions, like
  // the touch target — no spacing step is either.
  mark: {
    width: 44,
    height: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
