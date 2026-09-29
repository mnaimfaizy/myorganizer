import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
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
});
