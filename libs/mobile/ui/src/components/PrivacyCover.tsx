import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useTheme } from '../useTheme';
import { BrandMark } from './BrandMark';

export interface PrivacyCoverProps {
  visible: boolean;
}

/**
 * The opaque panel the app puts over itself whenever it leaves the foreground,
 * so the app switcher and any screen recording show the app's own mark instead
 * of a Vault (ADR 0108 decision 6). As drawn (Entry · Cover): the stacked brand
 * lockup, centred on the page background, and nothing else.
 *
 * A `Modal` rather than an absolutely positioned view, because on iOS a modal
 * is presented in its own window above the root view: a cover drawn inside the
 * root view would sit *under* an open `BottomSheet`, which is itself a modal,
 * and the one moment a User is most likely to leave the app is mid-sheet.
 * Modals present in order, so this one — mounted at the top of the tree and
 * shown last — covers whatever is already up.
 *
 * Deliberately not animated. The cover is racing the snapshot the OS takes on
 * the way out; a 300ms slide is a 300ms window of readable content in the app
 * switcher, and there is nothing to look at at the end of it.
 *
 * What it cannot promise: the snapshot is taken by the OS, so this is only as
 * early as `AppState` tells us about it. On iOS that is `inactive`, which is
 * early enough in practice; on Android `FLAG_SECURE` is the stronger tool and
 * is a native-side change this cover does not replace.
 */
export function PrivacyCover({
  visible,
}: PrivacyCoverProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        accessibilityViewIsModal
        accessibilityLabel="MyOrganizer is hidden"
        style={[styles.cover, { backgroundColor: theme.colors.background }]}
      >
        <BrandMark lockup="stacked" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cover: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
