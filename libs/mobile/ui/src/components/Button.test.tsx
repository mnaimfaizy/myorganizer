import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { Button } from './Button';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('Button Component', () => {
  it('should render with all variants', async () => {
    await render(
      <TestWrapper>
        <Button label="Primary" variant="primary" />
        <Button label="Secondary" variant="secondary" />
        <Button label="Delete" variant="destructive" />
        <Button label="Cancel" variant="ghost" />
      </TestWrapper>,
    );
    expect(await screen.findByLabelText('Primary')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Secondary')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Delete')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Cancel')).toBeOnTheScreen();
  });

  it('should call onPress when pressed', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <Button label="Click" onPress={onPress} />
      </TestWrapper>,
    );
    const button = await screen.findByLabelText('Click');
    await user.press(button);
    expect(onPress).toHaveBeenCalled();
  });

  it('should block press when disabled', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <Button label="Disabled" disabled={true} onPress={onPress} />
      </TestWrapper>,
    );
    const button = await screen.findByLabelText('Disabled');
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('should block press when busy', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <Button label="Loading" busy={true} onPress={onPress} />
      </TestWrapper>,
    );
    const button = await screen.findByLabelText('Loading');
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
