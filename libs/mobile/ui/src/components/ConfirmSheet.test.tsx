import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { ConfirmSheet } from './ConfirmSheet';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('ConfirmSheet Component', () => {
  it('should call onConfirm when the confirm button is pressed', async () => {
    const onConfirm = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <ConfirmSheet
          visible
          title="Delete task?"
          message="This can't be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={onConfirm}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    await user.press(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when Cancel is pressed', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <ConfirmSheet
          visible
          title="Delete task?"
          message="This can't be undone."
          confirmLabel="Delete"
          onConfirm={jest.fn()}
          onCancel={onCancel}
        />
      </TestWrapper>,
    );
    await user.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should not render a secondary button when secondaryLabel/onSecondary are omitted', async () => {
    await render(
      <TestWrapper>
        <ConfirmSheet
          visible
          title="Delete task?"
          message="This can't be undone."
          confirmLabel="Delete"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(
      screen.queryByRole('button', { name: 'Archive instead' }),
    ).toBeNull();
  });

  it('should render and call onSecondary for the third way out', async () => {
    const onSecondary = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <ConfirmSheet
          visible
          title="Delete task?"
          message="This can't be undone."
          confirmLabel="Delete"
          destructive
          secondaryLabel="Archive instead"
          onSecondary={onSecondary}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    await user.press(screen.getByRole('button', { name: 'Archive instead' }));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('should disable the secondary button while busy', async () => {
    await render(
      <TestWrapper>
        <ConfirmSheet
          visible
          title="Delete task?"
          message="This can't be undone."
          confirmLabel="Delete"
          secondaryLabel="Archive instead"
          onSecondary={jest.fn()}
          busy
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(
      screen.getByRole('button', { name: 'Archive instead' }).props
        .accessibilityState?.disabled,
    ).toBe(true);
  });

  it('should render each paragraph of a multi-part message', async () => {
    await render(
      <TestWrapper>
        <ConfirmSheet
          visible
          title="Log out?"
          message={[
            'Logging out also removes Biometric Unlock from this device.',
            'Your Vault stays on the server.',
          ]}
          confirmLabel="Log out"
          destructive
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(
      screen.getByText(
        'Logging out also removes Biometric Unlock from this device.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Your Vault stays on the server.'),
    ).toBeOnTheScreen();
  });

  it('should fill Cancel as a secondary button, and step it down to ghost beside a third way out', async () => {
    const { rerender } = await render(
      <TestWrapper>
        <ConfirmSheet
          visible
          title="Turn off Biometric Unlock?"
          message="You’ll unlock with your passphrase."
          confirmLabel="Turn off"
          cancelLabel="Keep it on"
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    const filled = screen.getByRole('button', { name: 'Keep it on' });
    expect(StyleSheet.flatten(filled.props.style).backgroundColor).not.toBe(
      'transparent',
    );

    await rerender(
      <TestWrapper>
        <ConfirmSheet
          visible
          title="Delete this task?"
          message="This can’t be undone. Archive keeps it instead."
          confirmLabel="Delete task"
          destructive
          secondaryLabel="Archive instead"
          secondaryIcon="archive"
          onSecondary={jest.fn()}
          onConfirm={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    const ghost = screen.getByRole('button', { name: 'Cancel' });
    expect(StyleSheet.flatten(ghost.props.style).backgroundColor).toBe(
      'transparent',
    );
  });
});
