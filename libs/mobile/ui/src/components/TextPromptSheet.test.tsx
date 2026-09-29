import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../useTheme';
import { TextPromptSheet } from './TextPromptSheet';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('TextPromptSheet Component', () => {
  it('should open with the initial value prefilled', async () => {
    await render(
      <TestWrapper>
        <TextPromptSheet
          visible
          title="Rename list"
          label="List name"
          initialValue="Weekly shop"
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByLabelText('List name').props.value).toBe('Weekly shop');
  });

  it('should disable Save while the field is empty', async () => {
    await render(
      <TestWrapper>
        <TextPromptSheet
          visible
          title="New list"
          label="List name"
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(
      screen.getByRole('button', { name: 'Save' }).props.accessibilityState
        ?.disabled,
    ).toBe(true);
  });

  it('should call onSubmit with the trimmed value', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <TextPromptSheet
          visible
          title="New list"
          label="List name"
          onSubmit={onSubmit}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    await user.type(screen.getByLabelText('List name'), '  Weekly shop  ');
    await user.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith('Weekly shop');
  });

  it('should call onCancel when Cancel is pressed', async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <TextPromptSheet
          visible
          title="New list"
          label="List name"
          onSubmit={jest.fn()}
          onCancel={onCancel}
        />
      </TestWrapper>,
    );
    await user.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should re-seed the draft to the new initialValue on reopen', async () => {
    const { rerender } = await render(
      <TestWrapper>
        <TextPromptSheet
          visible
          title="Rename list"
          label="List name"
          initialValue="Weekly shop"
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    // Closed, then reopened on a different list — the first list's draft
    // must not leak into the second's sheet.
    await rerender(
      <TestWrapper>
        <TextPromptSheet
          visible={false}
          title="Rename list"
          label="List name"
          initialValue="Weekly shop"
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    await rerender(
      <TestWrapper>
        <TextPromptSheet
          visible
          title="Rename list"
          label="List name"
          initialValue="Pantry restock"
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByLabelText('List name').props.value).toBe(
      'Pantry restock',
    );
  });

  it('should show a spinner and stop accepting input while busy', async () => {
    await render(
      <TestWrapper>
        <TextPromptSheet
          visible
          title="New list"
          label="List name"
          initialValue="Weekly shop"
          busy
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      </TestWrapper>,
    );
    expect(screen.getByLabelText('List name').props.editable).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Save' }).props.accessibilityState
        ?.busy,
    ).toBe(true);
  });
});
