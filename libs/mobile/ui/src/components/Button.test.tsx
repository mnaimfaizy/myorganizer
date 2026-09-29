import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { FONT_FAMILY } from '../typeScale';
import { BottomSheet } from './BottomSheet';
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

  it('should keep the label laid out but hidden while busy, and mark the button busy', async () => {
    await render(
      <TestWrapper>
        <Button label="Sign in" busy={true} />
      </TestWrapper>,
    );
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button.props.accessibilityState.busy).toBe(true);
    // The label stays in the tree, so the width holds, but it is invisible.
    let node = screen.getByText('Sign in').parent;
    let hidden = false;
    while (node != null && !hidden) {
      hidden = StyleSheet.flatten(node.props.style)?.opacity === 0;
      node = node.parent;
    }
    expect(hidden).toBe(true);
  });

  it('should set the label at 600 on the body-sm step', async () => {
    await render(
      <TestWrapper>
        <Button label="Save" />
      </TestWrapper>,
    );
    expect(
      StyleSheet.flatten(screen.getByText('Save').props.style),
    ).toMatchObject({
      fontFamily: FONT_FAMILY.bodySemiBold,
      fontSize: 15,
    });
  });

  it('should render the brand variant in the brand fill', async () => {
    await render(
      <TestWrapper>
        <Button label="Unlock" variant="brand" />
      </TestWrapper>,
    );
    const button = screen.getByRole('button', { name: 'Unlock' });
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(
      '#7c3aed',
    );
  });

  it('should underline a link', async () => {
    await render(
      <TestWrapper>
        <Button label="Forgot password?" variant="link" />
      </TestWrapper>,
    );
    expect(
      StyleSheet.flatten(screen.getByText('Forgot password?').props.style)
        .textDecorationLine,
    ).toBe('underline');
  });

  it('should take the accent fill for a secondary button on a dark sheet', async () => {
    await render(
      <ThemeProvider appearance="dark">
        <Button label="Page" variant="secondary" />
        <BottomSheet visible onDismiss={jest.fn()}>
          <Button label="Sheet" variant="secondary" />
        </BottomSheet>
      </ThemeProvider>,
    );
    const page = screen.getByRole('button', { name: 'Page' });
    const sheet = screen.getByRole('button', { name: 'Sheet' });
    // secondary (#0f172a) on the page, accent (#1d283a) on the raised sheet.
    expect(StyleSheet.flatten(page.props.style).backgroundColor).toBe(
      '#0f172a',
    );
    expect(StyleSheet.flatten(sheet.props.style).backgroundColor).toBe(
      '#1d283a',
    );
  });
});
