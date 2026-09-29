import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { MenuSheet } from './MenuSheet';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('MenuSheet Component', () => {
  it('should render every item label', async () => {
    await render(
      <TestWrapper>
        <MenuSheet
          visible
          onDismiss={jest.fn()}
          title="List menu"
          items={[
            { id: 'rename', label: 'Rename list', onPress: jest.fn() },
            { id: 'delete', label: 'Delete list', onPress: jest.fn() },
          ]}
        />
      </TestWrapper>,
    );
    expect(await screen.findByText('Rename list')).toBeOnTheScreen();
    expect(await screen.findByText('Delete list')).toBeOnTheScreen();
  });

  it('should dismiss and then call the item onPress when an item is pressed', async () => {
    const onDismiss = jest.fn();
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <MenuSheet
          visible
          onDismiss={onDismiss}
          items={[{ id: 'rename', label: 'Rename list', onPress }]}
        />
      </TestWrapper>,
    );
    await user.press(screen.getByRole('button', { name: 'Rename list' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
    // The sheet is dismissed before the item's own action runs, so a handler
    // that opens another sheet is not racing the menu's own close.
    expect(onDismiss.mock.invocationCallOrder[0]).toBeLessThan(
      onPress.mock.invocationCallOrder[0],
    );
  });

  it('should not render an icon glyph for an item that does not carry one', async () => {
    await render(
      <TestWrapper>
        <MenuSheet
          visible
          onDismiss={jest.fn()}
          items={[{ id: 'rename', label: 'Rename list', onPress: jest.fn() }]}
        />
      </TestWrapper>,
    );
    const item = screen.getByRole('button', { name: 'Rename list' });
    // Icon and Text are the only two possible children; no icon means one.
    expect(item.children).toHaveLength(1);
  });
});
