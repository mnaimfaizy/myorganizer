import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { FOCUS_LANDING_TEST_ID, FocusLanding } from './FocusLanding';

function landing() {
  return screen.queryByTestId(FOCUS_LANDING_TEST_ID, {
    includeHiddenElements: true,
  });
}

describe('FocusLanding Component', () => {
  describe('on Android', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    it('should be a view Android can give keyboard focus to', async () => {
      await render(<FocusLanding />);
      expect(landing()?.props.focusable).toBe(true);
      // A view with no content is otherwise dropped from the native tree.
      expect(landing()?.props.collapsable).toBe(false);
    });

    it('should do nothing when activated', async () => {
      await render(<FocusLanding />);
      const handlers = Object.keys(landing()?.props ?? {}).filter((name) =>
        /^on[A-Z]/.test(name),
      );
      expect(handlers).toEqual([]);
    });

    it('should not be a screen-reader stop', async () => {
      await render(<FocusLanding />);
      expect(landing()?.props.importantForAccessibility).toBe('no');
    });

    it('should leave `accessible` unset, which would make it unfocusable', async () => {
      await render(<FocusLanding />);
      expect(landing()?.props).not.toHaveProperty('accessible');
    });

    it('should take no touches', async () => {
      await render(<FocusLanding />);
      expect(landing()?.props.pointerEvents).toBe('none');
    });

    it('should sit out of the layout at the top-left corner with a size', async () => {
      await render(<FocusLanding />);
      expect(StyleSheet.flatten(landing()?.props.style)).toEqual({
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1,
        height: 1,
      });
    });

    it('should draw nothing', async () => {
      await render(<FocusLanding />);
      const style = StyleSheet.flatten(landing()?.props.style);
      expect(style).not.toHaveProperty('backgroundColor');
      expect(style).not.toHaveProperty('outlineWidth');
      expect(landing()?.children).toEqual([]);
    });
  });

  it('should render nothing on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(<FocusLanding />);
    expect(landing()).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });
});
