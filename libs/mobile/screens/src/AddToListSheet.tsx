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
  ListRow,
  StatusPill,
  Text,
  useTheme,
} from '@myorganizer/mobile/ui';
import { TextField } from '@myorganizer/mobile/ui';
import type { CatalogEntry } from './groceryTripModel';

export interface AddToListSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Every Catalog Item, for the type-ahead to search over. */
  catalog: readonly CatalogEntry[];
  /** Catalog Item ids already on this list — shown as "On list" and inert. */
  onListItemIds: ReadonlySet<string>;
  /** An existing Catalog Item was chosen. The sheet is already dismissed. */
  onAddExisting: (item: CatalogEntry) => void;
  /** A new Catalog Item is wanted. The sheet is already dismissed. */
  onCreate: (name: string, category: GroceryCategoryType) => void;
}

/** How many matches the type-ahead shows at once. */
const MAX_MATCHES = 20;

/**
 * Type-ahead over the Catalog, for adding to one Grocery List (#914).
 *
 * Choosing an existing Catalog Item and creating a new one both dismiss the
 * sheet immediately and hand the edit to the caller — the trip view already
 * has an Unconfirmed Edit state for a line that has not reached the server
 * yet, and showing that on the trip view itself (rather than keeping this
 * sheet open on a spinner) is the one place that state exists.
 */
export function AddToListSheet({
  visible,
  onDismiss,
  catalog,
  onListItemIds,
  onAddExisting,
  onCreate,
}: AddToListSheetProps): React.JSX.Element {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<'search' | 'category'>('search');
  const [category, setCategory] = useState<GroceryCategoryType>('other');

  // Reset on every opening, so a sheet reopened after adding one item does
  // not still show the last search or sit on the category step.
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
    onDismiss();
    onAddExisting(item);
  };

  const handleCreate = (): void => {
    onDismiss();
    onCreate(trimmedQuery, category);
  };

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title={step === 'search' ? 'Add to list' : `Add "${trimmedQuery}"`}
    >
      {step === 'search' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <TextField
            placeholder="Search catalog"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Search catalog"
          />
          <ScrollView
            style={styles.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ gap: theme.spacing.xs }}>
              {matches.map((item) => {
                const onList = onListItemIds.has(item.id);
                return (
                  <ListRow
                    key={item.id}
                    title={item.name}
                    subtitle={groceryCategoryLabel(item.category)}
                    trailing={onList ? <StatusPill label="On list" /> : null}
                    accessibilityLabel={
                      onList
                        ? `${item.name}, already on list`
                        : `Add ${item.name} to list`
                    }
                    onPress={onList ? undefined : () => handleAddExisting(item)}
                    style={{ borderRadius: theme.radii.md }}
                  />
                );
              })}

              {matches.length === 0 && trimmedQuery.length === 0 && (
                <EmptyState
                  icon="groceries"
                  title="Nothing in the catalog yet"
                  description="Type a name below to create the first one."
                />
              )}

              {trimmedQuery.length > 0 && !hasExactMatch && (
                <Button
                  label={`Create "${trimmedQuery}"`}
                  variant="secondary"
                  icon="plus"
                  onPress={() => setStep('category')}
                />
              )}
            </View>
          </ScrollView>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="body" color="mutedForeground">
            Choose a category for &quot;{trimmedQuery}&quot;.
          </Text>
          <View style={[styles.chips, { gap: theme.spacing.sm }]}>
            {GROCERY_CATEGORY_ORDER.map((option) => (
              <Chip
                key={option}
                label={groceryCategoryLabel(option)}
                selected={category === option}
                onPress={() => setCategory(option)}
              />
            ))}
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <Button label="Add to catalog" onPress={handleCreate} />
            <Button
              label="Back"
              variant="ghost"
              onPress={() => setStep('search')}
            />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  results: {
    maxHeight: 360,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
