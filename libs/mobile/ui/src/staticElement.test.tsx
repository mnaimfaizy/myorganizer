import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ThemeProvider } from './useTheme';
import { BrandMark } from './components/BrandMark';
import { InlineNotice } from './components/InlineNotice';
import { ProgressMeter } from './components/ProgressMeter';
import { TextField } from './components/TextField';
import { staticElement } from './staticElement';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

/**
 * Android puts a view in the Tab order when it is `accessible`, so on Android
 * a view that is read but does nothing must not be — and must say it is a
 * screen reader's to land on some other way. Only a view with a label of its
 * own and no text inside may; `ListRow.test.tsx` covers the other such site.
 */
describe('staticElement', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is an accessibility element on iOS', () => {
    expect(staticElement()).toEqual({ accessible: true });
  });

  it('is a screen reader stop and not a keyboard stop on Android', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(staticElement()).toEqual({
      accessible: false,
      screenReaderFocusable: true,
    });
  });

  describe('BrandMark with the mark alone', () => {
    it('is no keyboard stop on Android and keeps its label', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(
        <TestWrapper>
          <BrandMark lockup="mark" />
        </TestWrapper>,
      );
      const mark = screen.getByLabelText('MyOrganizer');
      expect(mark.props.accessible).toBe(false);
      expect(mark.props.focusable).toBeUndefined();
      expect(mark.props.screenReaderFocusable).toBe(true);
    });

    it('stays an accessibility element on iOS', async () => {
      await render(
        <TestWrapper>
          <BrandMark lockup="mark" />
        </TestWrapper>,
      );
      expect(screen.getByLabelText('MyOrganizer').props.accessible).toBe(true);
    });
  });

  /**
   * What must not take the helper, each for a way TalkBack was seen to split
   * it: a view whose text is its children's, and a labelled view that holds
   * text of its own. On Android they stay plain `accessible`.
   */
  describe.each([
    ['BrandMark with its wordmark', 'image', <BrandMark lockup="inline" />],
    [
      'InlineNotice message',
      'alert',
      <InlineNotice message="Settings on this tab belong to this phone." />,
    ],
    [
      'TextField error',
      'alert',
      <TextField
        label="Name"
        value=""
        onChangeText={jest.fn()}
        error="Enter a name."
      />,
    ],
    [
      'ProgressMeter',
      'progressbar',
      <ProgressMeter label="Picked up" value={0.25} />,
    ],
  ])('%s', (_, role, ui) => {
    it('stays one accessible element on Android', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(<TestWrapper>{ui}</TestWrapper>);
      const element = screen.getByRole(role);
      expect(element.props.accessible).toBe(true);
      expect(element.props.screenReaderFocusable).toBeUndefined();
    });
  });
});
