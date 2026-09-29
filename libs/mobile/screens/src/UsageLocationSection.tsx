import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Checkbox,
  EmptyState,
  IconButton,
  ListRow,
  ListSection,
  ProgressMeter,
  useTheme,
  type ListRowState,
} from '@myorganizer/mobile/ui';
import type { VaultBlobWriteErrorKind } from '@myorganizer/mobile/feat-vault';
import {
  describeUsageLocationMeta,
  isNotified,
  notifiedProgress,
  selectUsageLocationsForDetail,
  type DecryptedUsageLocation,
} from './contactModel';

export interface UsageLocationSectionProps {
  usageLocations: readonly DecryptedUsageLocation[];
  writing: boolean;
  /** Where one Usage Location's edit stands — `unconfirmed` while its tick is
   * in flight, `reverted` when the last one failed. */
  rowState: (id: string) => ListRowState;
  writeError: VaultBlobWriteErrorKind | null;
  onToggleNotified: (location: DecryptedUsageLocation) => void;
  onRetry: () => void;
  retryLabel: string;
  revertedReason: string | undefined;
}

/**
 * One Address or Mobile Number's Usage Locations: "n of m notified", then
 * every one still unnotified by priority, then every notified one — the
 * order `selectUsageLocationsForDetail` decides. Ticking notified is the
 * only edit this screen offers; creating, editing, or deleting a Usage
 * Location stays web-only.
 */
export function UsageLocationSection({
  usageLocations,
  writing,
  rowState,
  writeError,
  onToggleNotified,
  onRetry,
  retryLabel,
  revertedReason,
}: UsageLocationSectionProps): React.JSX.Element {
  const theme = useTheme();
  const progress = notifiedProgress(usageLocations);
  const ordered = selectUsageLocationsForDetail(usageLocations);

  return (
    <ListSection
      title="Usage Locations"
      meta={`${progress.notified} of ${progress.total}`}
      style={{ gap: theme.spacing.md }}
    >
      <ProgressMeter
        value={progress.total > 0 ? progress.notified / progress.total : 0}
        label="Notified"
        meta={`${progress.notified} of ${progress.total}`}
      />

      {ordered.length === 0 ? (
        <EmptyState
          title="No Usage Locations"
          description="Add one on the web."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {ordered.map((location) => {
            const notified = isNotified(location);
            const state = rowState(location.id);
            const name = location.organisationName ?? 'Organisation';
            const link = location.link;

            return (
              <ListRow
                key={location.id}
                title={name}
                subtitle={describeUsageLocationMeta(location)}
                checked={notified}
                accessibilityLabel={`${name}, ${notified ? 'notified' : 'not notified'}`}
                onPress={writing ? undefined : () => onToggleNotified(location)}
                leading={
                  <Checkbox
                    checked={notified}
                    disabled={writing}
                    accessibilityLabel={name}
                    onChange={() => onToggleNotified(location)}
                  />
                }
                trailing={
                  link != null && link.length > 0 ? (
                    <IconButton
                      icon="chevronRight"
                      accessibilityLabel={`Open update link for ${name}`}
                      onPress={() => void Linking.openURL(link)}
                    />
                  ) : undefined
                }
                innerActions={
                  link != null && link.length > 0
                    ? [
                        {
                          id: 'open-link',
                          label: 'Open update link',
                          onPress: () => void Linking.openURL(link),
                        },
                      ]
                    : []
                }
                state={state}
                revertedReason={
                  state === 'reverted' ? revertedReason : undefined
                }
                retryLabel={retryLabel}
                onRetry={writeError != null ? onRetry : undefined}
                style={[styles.row, { borderRadius: theme.radii.md }]}
              />
            );
          })}
        </View>
      )}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  row: {
    overflow: 'hidden',
  },
});
