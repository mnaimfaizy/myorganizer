import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { lightTheme } from '../theme';
import { FOCUS_RING_OUTSET } from '../hooks/useFocusRing';
import { Chip } from './Chip';
import { ChipScroller, revealOffset } from './ChipScroller';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('revealOffset', () => {
  // A 300pt scroller over content with a chip at 100–180.
  const chip = { start: 100, end: 180, viewport: 300, margin: 16 };

  it('stays put when the span is in view with its margin', () => {
    expect(revealOffset({ ...chip, offset: 0 })).toBe(0);
    expect(revealOffset({ ...chip, offset: 84 })).toBe(84);
  });

  it('scrolls back until the margin before the span is in view', () => {
    // Android brings a focused view flush to the edge and no further.
    expect(revealOffset({ ...chip, offset: 100 })).toBe(84);
    expect(revealOffset({ ...chip, offset: 150 })).toBe(84);
  });

  it('scrolls on until the margin after the span is in view', () => {
    expect(revealOffset({ ...chip, start: 400, end: 480, offset: 180 })).toBe(
      196,
    );
  });

  it('never scrolls before the start of the content', () => {
    expect(revealOffset({ ...chip, start: 8, end: 80, offset: 40 })).toBe(0);
  });

  it('stays put until the scroller has been measured', () => {
    expect(revealOffset({ ...chip, viewport: 0, offset: 150 })).toBe(150);
  });
});

describe('ChipScroller', () => {
  const Row = () => (
    <TestWrapper>
      <ChipScroller>
        <Chip label="Today" onPress={jest.fn()} />
        <Chip label="Context" onPress={jest.fn()} />
      </ChipScroller>
    </TestWrapper>
  );

  /** The scroller, and the row its chips sit in. */
  const parts = async () => {
    await render(<Row />);
    return {
      scroller: screen.getByTestId('chip-scroller'),
      row: screen.getByTestId('chip-scroller-row'),
    };
  };

  it("gives the ring its reach above and below without growing the row's height", async () => {
    const { scroller, row } = await parts();
    const outer = StyleSheet.flatten(scroller.props.style);
    expect(outer.marginVertical).toBe(-FOCUS_RING_OUTSET);

    const inner = StyleSheet.flatten(row.props.style);
    expect(inner.paddingVertical).toBe(FOCUS_RING_OUTSET);
    // What the scroller is pulled out by is what its content is padded by.
    expect(inner.paddingVertical + outer.marginVertical).toBe(0);
    expect(inner.paddingHorizontal).toBe(lightTheme.spacing.md);
  });

  it('scrolls a chip Android left flush to the far edge in by the inset (#1052)', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const { scroller, row } = await parts();
    await fireEvent(scroller, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 44 } },
    });
    // Android has scrolled the chip at 400–480 just into view.
    await fireEvent.scroll(scroller, {
      nativeEvent: { contentOffset: { x: 180, y: 0 } },
    });

    await fireEvent(row, 'focus', {
      target: {
        measureLayout: (
          _row: unknown,
          onSuccess: (x: number, y: number, w: number, h: number) => void,
        ) => onSuccess(400, 4, 80, 36),
      },
    });

    expect(scrollTo).toHaveBeenCalledWith({
      x: 180 + lightTheme.spacing.md,
      animated: false,
    });
    scrollTo.mockRestore();
  });

  it('leaves the scroller alone when the focused chip already has its room', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const { scroller, row } = await parts();
    await fireEvent(scroller, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 44 } },
    });

    await fireEvent(row, 'focus', {
      target: {
        measureLayout: (
          _row: unknown,
          onSuccess: (x: number, y: number, w: number, h: number) => void,
        ) => onSuccess(lightTheme.spacing.md, 4, 80, 36),
      },
    });

    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
