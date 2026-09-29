import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Text, useTheme } from '@myorganizer/mobile/ui';
import type { CopyableField } from './contactModel';

export interface ContactFieldRowProps {
  field: CopyableField;
  onCopy: (field: CopyableField) => void;
}

/**
 * One Address or Mobile Number field: its label, its value, and its own copy
 * button. Every field a Detail screen shows is one of these, so a value
 * never leaves the field it belongs to except through this explicit press —
 * there is no long-press-to-select-text path here to leave unguarded.
 */
export function ContactFieldRow({
  field,
  onCopy,
}: ContactFieldRowProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.md }]}>
      <View style={[styles.labels, { gap: theme.spacing.xs }]}>
        <Text variant="labelCaps" color="mutedForeground">
          {field.label}
        </Text>
        <Text variant="body">{field.value}</Text>
      </View>
      <IconButton
        icon="copy"
        accessibilityLabel={`Copy ${field.label}`}
        onPress={() => onCopy(field)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labels: {
    flexShrink: 1,
    flexGrow: 1,
  },
});
