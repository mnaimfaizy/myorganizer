import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { TabBar, type TabBarItem } from './TabBar';
import * as useKeyboardVisibleModule from '../hooks/useKeyboardVisible';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

const defaultItems: TabBarItem[] = [
  { key: 'home', label: 'Home', icon: 'tasks' },
  { key: 'tasks', label: 'Tasks', icon: 'tasks' },
  { key: 'settings', label: 'Settings', icon: 'details' },
];

describe('TabBar Component', () => {
  it('should render tabs with labels', async () => {
    await render(
      <TestWrapper>
        <TabBar items={defaultItems} activeKey="home" onSelect={jest.fn()} />
      </TestWrapper>,
    );
    expect(await screen.findByLabelText('Home')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Tasks')).toBeOnTheScreen();
  });

  it('should call onSelect when tab is pressed', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <TabBar items={defaultItems} activeKey="home" onSelect={onSelect} />
      </TestWrapper>,
    );
    const tasksTab = await screen.findByLabelText('Tasks');
    await user.press(tasksTab);
    expect(onSelect).toHaveBeenCalledWith('tasks');
  });

  it('should apply maxFontSizeMultiplier 1.3 to tab labels', async () => {
    await render(
      <TestWrapper>
        <TabBar items={defaultItems} activeKey="home" onSelect={jest.fn()} />
      </TestWrapper>,
    );
    const label = screen.getByText('Home');
    expect(label.props.maxFontSizeMultiplier).toBe(1.3);
  });

  it('should use Inter-Bold for active tab label', async () => {
    await render(
      <TestWrapper>
        <TabBar items={defaultItems} activeKey="home" onSelect={jest.fn()} />
      </TestWrapper>,
    );
    const label = screen.getByText('Home');
    expect(StyleSheet.flatten(label.props.style).fontFamily).toBe('Inter-Bold');
  });

  it('should use Inter-Medium for inactive tab labels', async () => {
    await render(
      <TestWrapper>
        <TabBar items={defaultItems} activeKey="home" onSelect={jest.fn()} />
      </TestWrapper>,
    );
    const label = screen.getByText('Tasks');
    expect(StyleSheet.flatten(label.props.style).fontFamily).toBe(
      'Inter-Medium',
    );
  });

  describe('Keyboard visibility', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should render tabs when keyboard is not visible', async () => {
      jest
        .spyOn(useKeyboardVisibleModule, 'useKeyboardVisible')
        .mockReturnValue(false);

      await render(
        <TestWrapper>
          <TabBar items={defaultItems} activeKey="home" onSelect={jest.fn()} />
        </TestWrapper>,
      );
      expect(await screen.findByLabelText('Home')).toBeOnTheScreen();
      expect(await screen.findByLabelText('Tasks')).toBeOnTheScreen();
    });

    it('should return null when keyboard is visible', async () => {
      jest
        .spyOn(useKeyboardVisibleModule, 'useKeyboardVisible')
        .mockReturnValue(true);

      await render(
        <TestWrapper>
          <TabBar items={defaultItems} activeKey="home" onSelect={jest.fn()} />
        </TestWrapper>,
      );

      expect(screen.queryByLabelText('Home')).toBeNull();
      expect(screen.queryByLabelText('Tasks')).toBeNull();
    });

    it('should show tabs when keyboard becomes not visible', async () => {
      const mockUseKeyboardVisible = jest.spyOn(
        useKeyboardVisibleModule,
        'useKeyboardVisible',
      );
      mockUseKeyboardVisible.mockReturnValue(true);

      const { rerender } = await render(
        <TestWrapper>
          <TabBar items={defaultItems} activeKey="home" onSelect={jest.fn()} />
        </TestWrapper>,
      );

      expect(screen.queryByLabelText('Home')).toBeNull();

      mockUseKeyboardVisible.mockReturnValue(false);

      await rerender(
        <TestWrapper>
          <TabBar items={defaultItems} activeKey="home" onSelect={jest.fn()} />
        </TestWrapper>,
      );

      expect(await screen.findByLabelText('Home')).toBeOnTheScreen();
    });
  });
});
