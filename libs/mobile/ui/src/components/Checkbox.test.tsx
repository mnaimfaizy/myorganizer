import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../useTheme';
import { MIN_TOUCH_TARGET } from '../metrics';
import { Checkbox } from './Checkbox';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

/**
 * The haptic stub `jest.setup.ts` installs. Typed rather than cast to `any` so
 * that a change to the stub's shape fails here instead of reading as a control
 * that stopped triggering feedback.
 */
function hapticTrigger(): jest.Mock {
  const module = jest.requireMock<{ default: { trigger: jest.Mock } }>(
    'react-native-haptic-feedback',
  );
  return module.default.trigger;
}

/** The box a Checkbox draws, inside its 44pt target. */
function boxStyle() {
  return StyleSheet.flatten(
    screen.getByTestId('checkbox-box', { includeHiddenElements: true }).props
      .style,
  );
}

describe('Checkbox Component', () => {
  it('should render with checkbox role', async () => {
    await render(
      <TestWrapper>
        <Checkbox checked={false} onChange={jest.fn()} label="Item" />
      </TestWrapper>,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeTruthy();
  });

  it('should report checked state through accessibility', async () => {
    await render(
      <TestWrapper>
        <Checkbox checked={true} onChange={jest.fn()} label="Item" />
      </TestWrapper>,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props?.accessibilityState?.checked).toBe(true);
  });

  it('should call onChange with negated value when pressed', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <Checkbox checked={false} onChange={onChange} label="Item" />
      </TestWrapper>,
    );
    const checkbox = screen.getByRole('checkbox');
    await user.press(checkbox);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should accept standard and large size props without error', async () => {
    await render(
      <TestWrapper>
        <Checkbox
          checked={false}
          onChange={jest.fn()}
          size="standard"
          label="Std"
        />
        <Checkbox
          checked={false}
          onChange={jest.fn()}
          size="large"
          label="Lg"
        />
      </TestWrapper>,
    );
    expect(await screen.findByLabelText('Std')).toBeOnTheScreen();
    expect(await screen.findByLabelText('Lg')).toBeOnTheScreen();
  });

  it('should render box size 24pt for standard size', async () => {
    await render(
      <TestWrapper>
        <Checkbox checked={false} onChange={jest.fn()} size="standard" />
      </TestWrapper>,
    );
    expect(boxStyle().width).toBe(24);
  });

  it('should render box size 28pt for large size', async () => {
    await render(
      <TestWrapper>
        <Checkbox checked={false} onChange={jest.fn()} size="large" />
      </TestWrapper>,
    );
    expect(boxStyle().width).toBe(28);
  });

  it('should trigger the light impact haptic when ticking (unchecked to checked)', async () => {
    const trigger = hapticTrigger();
    trigger.mockClear();

    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <Checkbox checked={false} onChange={jest.fn()} />
      </TestWrapper>,
    );
    const checkbox = screen.getByRole('checkbox');
    await user.press(checkbox);
    expect(trigger).toHaveBeenCalledWith('impactLight', expect.any(Object));
  });

  it('should trigger selection haptic when unticking (checked to unchecked)', async () => {
    const trigger = hapticTrigger();
    trigger.mockClear();

    const user = userEvent.setup();
    await render(
      <TestWrapper>
        <Checkbox checked={true} onChange={jest.fn()} />
      </TestWrapper>,
    );
    const checkbox = screen.getByRole('checkbox');
    await user.press(checkbox);
    expect(trigger).toHaveBeenCalledWith('selection', expect.any(Object));
  });

  it('should draw the box at the 6pt design radius rounded up to the md step', async () => {
    await render(
      <TestWrapper>
        <Checkbox checked={false} onChange={jest.fn()} />
      </TestWrapper>,
    );
    expect(boxStyle().borderRadius).toBe(8);
  });

  it('should give the box a touch target of MIN_TOUCH_TARGET on both axes', async () => {
    await render(
      <TestWrapper>
        <Checkbox checked={false} onChange={jest.fn()} />
      </TestWrapper>,
    );
    const target = StyleSheet.flatten(
      screen.getByTestId('checkbox-target', { includeHiddenElements: true })
        .props.style,
    );
    expect(target.width).toBe(MIN_TOUCH_TARGET);
    expect(target.height).toBe(MIN_TOUCH_TARGET);
  });

  it('should take the disabled checkbox off the focus path', async () => {
    await render(
      <TestWrapper>
        <Checkbox checked={false} onChange={jest.fn()} disabled />
      </TestWrapper>,
    );
    const control = screen.getByRole('checkbox');
    expect(control.props.focusable).toBe(false);
  });
});

/**
 * Android takes focus from a view as it is disabled, and gives it to the first
 * focusable view in the window. A box disabled for the length of the save its
 * own tick started lost the keyboard's place that way (#1068).
 */
describe('Checkbox disabled while it holds keyboard focus', () => {
  const renderBox = (disabled: boolean, onChange = jest.fn()) => (
    <TestWrapper>
      <Checkbox
        checked={false}
        onChange={onChange}
        label="Item"
        disabled={disabled}
      />
    </TestWrapper>
  );
  const box = () => screen.getByRole('checkbox');
  /** The control's own focus or blur, as React Native names it. */
  const own = () => ({ target: box(), currentTarget: box() });

  it('is disabled and off the focus path when it does not hold focus', async () => {
    await render(renderBox(true));
    expect(box().props.accessibilityState.disabled).toBe(true);
    expect(box().props.focusable).toBe(false);
  });

  it('stays a focusable, enabled view when disabled with focus on it', async () => {
    const view = await render(renderBox(false));
    await fireEvent(box(), 'focus', own());
    await view.rerender(renderBox(true));

    expect(box().props.accessibilityState.disabled).toBe(false);
    expect(box().props.focusable).toBe(true);
  });

  it('still refuses a press, with no haptic', async () => {
    const onChange = jest.fn();
    const view = await render(renderBox(false, onChange));
    await fireEvent(box(), 'focus', own());
    await view.rerender(renderBox(true, onChange));
    hapticTrigger().mockClear();

    await fireEvent.press(box());
    expect(onChange).not.toHaveBeenCalled();
    expect(hapticTrigger()).not.toHaveBeenCalled();
  });

  it('is disabled for real once focus moves on', async () => {
    const view = await render(renderBox(false));
    await fireEvent(box(), 'focus', own());
    await view.rerender(renderBox(true));
    await fireEvent(box(), 'blur', own());

    expect(box().props.accessibilityState.disabled).toBe(true);
    expect(box().props.focusable).toBe(false);
  });

  it('takes presses again when the save is over', async () => {
    const onChange = jest.fn();
    const view = await render(renderBox(false, onChange));
    await fireEvent(box(), 'focus', own());
    await view.rerender(renderBox(true, onChange));
    await view.rerender(renderBox(false, onChange));

    await fireEvent.press(box());
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
