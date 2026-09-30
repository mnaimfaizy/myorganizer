import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { SegmentedControl } from './SegmentedControl';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('SegmentedControl Component', () => {
  const segments = [
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
  ];

  it('should render segments', async () => {
    await render(
      <TestWrapper>
        <SegmentedControl
          segments={segments}
          value="list"
          onChange={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(await screen.findByLabelText('List')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Grid')).toBeOnTheScreen();
  });

  it('should call onChange when segment is pressed', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <SegmentedControl
          segments={segments}
          value="list"
          onChange={onChange}
        />
      </TestWrapper>,
    );
    const gridButton = await screen.findByLabelText('Grid');
    await user.press(gridButton);
    expect(onChange).toHaveBeenCalledWith('grid');
  });
});
