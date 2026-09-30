import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { Checkbox } from './Checkbox';
import { ListRow } from './ListRow';
import { Text } from './Text';

// The Tasks list's row: the leading Checkbox ticks, the row body opens the
// Task, a marker sits before the title and the meta line carries styled runs.

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('ListRow — a row whose leading Checkbox is the tick target', () => {
  it('announces as a button that opens, not as a checkbox, while still carrying the checked state', async () => {
    const onPress = jest.fn();
    await render(
      <TestWrapper>
        <ListRow
          title="Pay water bill"
          checked
          tickTarget="leading"
          onPress={onPress}
        />
      </TestWrapper>,
    );

    expect(screen.queryByRole('checkbox')).toBeNull();
    const row = screen.getByRole('button', { name: 'Pay water bill' });
    expect(row.props.accessibilityState.checked).toBe(true);

    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ticks through the leading Checkbox without pressing the row', async () => {
    const onPress = jest.fn();
    const onChange = jest.fn();
    await render(
      <TestWrapper>
        <ListRow
          title="Pay water bill"
          checked={false}
          tickTarget="leading"
          onPress={onPress}
          leading={
            <Checkbox
              checked={false}
              accessibilityLabel="Done: Pay water bill"
              onChange={onChange}
            />
          }
        />
      </TestWrapper>,
    );

    fireEvent.press(screen.getByLabelText('Done: Pay water bill'));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps the whole-row checkbox by default', async () => {
    await render(
      <TestWrapper>
        <ListRow title="Oat milk" checked={false} onPress={jest.fn()} />
      </TestWrapper>,
    );
    expect(screen.getByRole('checkbox')).toBeOnTheScreen();
  });
});

describe('ListRow — title accessory and subtitle content', () => {
  it('draws the accessory before the title', async () => {
    await render(
      <TestWrapper>
        <ListRow
          title="Renew passport"
          titleAccessory={<Text testID="marker">▮</Text>}
        />
      </TestWrapper>,
    );
    expect(screen.getByTestId('marker')).toBeOnTheScreen();
    expect(screen.getByText('Renew passport')).toBeOnTheScreen();
  });

  it('draws the subtitle content in place of the string, which stays the spoken text', async () => {
    await render(
      <TestWrapper>
        <ListRow
          title="Pay water bill"
          subtitle="2 days overdue · Personal"
          subtitleContent={<Text testID="meta">styled meta</Text>}
          onPress={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByTestId('meta')).toBeOnTheScreen();
    expect(screen.queryByText('2 days overdue · Personal')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: 'Pay water bill, 2 days overdue · Personal',
      }),
    ).toBeOnTheScreen();
  });

  it('draws the subtitle content beside a subtitle accessory', async () => {
    await render(
      <TestWrapper>
        <ListRow
          title="Send Q3 report"
          subtitle="Today · Work"
          subtitleContent={<Text>styled meta</Text>}
          subtitleAccessory={<Text>IN PROGRESS</Text>}
        />
      </TestWrapper>,
    );
    expect(screen.getByText('styled meta')).toBeOnTheScreen();
    expect(screen.getByText('IN PROGRESS')).toBeOnTheScreen();
  });

  it('draws a tall row at 72', async () => {
    await render(
      <TestWrapper>
        <ListRow title="Tall" size="tall" onPress={jest.fn()} />
      </TestWrapper>,
    );
    const row = screen.getByRole('button', { name: 'Tall' });
    expect(StyleSheet.flatten(row.props.style).minHeight).toBe(72);
  });
});
