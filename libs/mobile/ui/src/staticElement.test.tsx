import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ThemeProvider } from './useTheme';
import { BrandMark } from './components/BrandMark';
import { InlineNotice } from './components/InlineNotice';
import { OfflineBanner } from './components/OfflineBanner';
import { ProgressMeter } from './components/ProgressMeter';
import { TextField } from './components/TextField';
import { staticElement } from './staticElement';

jest.mock('@react-native-community/netinfo');

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

/**
 * Android puts a view in the Tab order when it is `accessible`, so on Android
 * a view that is read but does nothing must not be — and must say it is a
 * screen reader's to land on some other way. `ListRow.test.tsx` covers the
 * row that does nothing.
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
   * A view that holds text. On Android it is named by a label of its own and
   * every `Text` inside is kept from the screen reader — without both,
   * TalkBack reads the view and then each `Text` as stops of their own.
   */
  describe.each([
    [
      'BrandMark with its wordmark',
      'image',
      'MyOrganizer',
      <BrandMark lockup="inline" />,
    ],
    [
      'InlineNotice message',
      'alert',
      'Settings on this tab belong to this phone.',
      <InlineNotice message="Settings on this tab belong to this phone." />,
    ],
    [
      'TextField error',
      'alert',
      'Enter a name.',
      <TextField
        label="Name"
        value=""
        onChangeText={jest.fn()}
        error="Enter a name."
      />,
    ],
    [
      'ProgressMeter with a label',
      'progressbar',
      'Picked up',
      <ProgressMeter label="Picked up" meta="1 of 4" value={0.25} />,
    ],
    [
      'OfflineBanner',
      'text',
      'You’re offline — changes can’t be saved',
      <OfflineBanner />,
    ],
  ])('%s', (_, role, label, ui) => {
    beforeEach(() => {
      (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
        callback({ isConnected: false, isInternetReachable: false });
        return jest.fn();
      });
    });

    it('is one labelled screen reader stop and no keyboard stop on Android', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(<TestWrapper>{ui}</TestWrapper>);
      const element = screen.getByLabelText(label);
      expect(element.props.accessible).toBe(false);
      expect(element.props.focusable).toBeUndefined();
      expect(element.props.screenReaderFocusable).toBe(true);
      expect(element.props.accessibilityRole).toBe(role);
    });

    it('leaves no text inside for a screen reader to land on', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await render(<TestWrapper>{ui}</TestWrapper>);
      const texts = readableTexts(screen.getByLabelText(label));
      expect(texts).toEqual([]);
    });

    it('stays a plain accessibility element on iOS', async () => {
      await render(<TestWrapper>{ui}</TestWrapper>);
      // The outermost: a `Text` inside answers to the `text` role as well.
      const [element] = screen.getAllByRole(role);
      expect(element.props.accessible).toBe(true);
      expect(element.props.screenReaderFocusable).toBeUndefined();
    });
  });

  it('names a view from its text on Android only', () => {
    expect(staticElement('Enter a name.')).toEqual({ accessible: true });
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(staticElement('Enter a name.')).toEqual({
      accessible: false,
      screenReaderFocusable: true,
      accessibilityLabel: 'Enter a name.',
    });
  });

  it('keeps the text of an unlabelled ProgressMeter readable', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(
      <TestWrapper>
        <ProgressMeter meta="1 of 4" value={0.25} />
      </TestWrapper>,
    );
    const meter = screen.getByRole('progressbar');
    expect(meter.props.accessible).toBe(true);
    expect(readableTexts(meter)).toEqual(['1 of 4']);
  });
});

type Node = {
  type: string;
  props: Record<string, unknown>;
  children: readonly (Node | string)[];
};

/** The text of every `Text` under `root` that Android's screen reader can reach. */
function readableTexts(root: Node): string[] {
  const found: string[] = [];
  const visit = (node: Node): void => {
    const hidden = node.props.importantForAccessibility;
    if (hidden === 'no-hide-descendants') return;
    if (node.type === 'Text') {
      if (hidden !== 'no') found.push(textOf(node));
      return;
    }
    for (const child of node.children) {
      if (typeof child !== 'string') visit(child);
    }
  };
  for (const child of root.children) {
    if (typeof child !== 'string') visit(child);
  }
  return found;
}

function textOf(node: Node): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : textOf(child)))
    .join('');
}
