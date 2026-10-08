import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { useFocusWithin } from './useFocusWithin';

/**
 * A group as the Tasks composer builds one: the handlers sit on the view
 * around its controls. Focus and blur bubble to that view on a device, so an
 * event from any control inside is one of these two calls.
 */
function Group({ onLeave }: { onLeave: () => void }): React.JSX.Element {
  const within = useFocusWithin(onLeave);
  return (
    <View testID="group" onFocus={within.onFocus} onBlur={within.onBlur} />
  );
}

async function send(event: 'onFocus' | 'onBlur'): Promise<void> {
  const group = screen.getByTestId('group');
  await act(async () => {
    group.props[event]();
  });
}

/** Runs the check a blur left owing. */
async function settle(): Promise<void> {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
}

describe('useFocusWithin', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('says focus left once a blur is followed by no focus inside', async () => {
    const onLeave = jest.fn();
    await render(<Group onLeave={onLeave} />);

    await send('onFocus');
    await send('onBlur');
    // Not yet: the next control has not been told it has focus.
    expect(onLeave).not.toHaveBeenCalled();

    await settle();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('says nothing when focus moved to another control inside', async () => {
    const onLeave = jest.fn();
    await render(<Group onLeave={onLeave} />);

    await send('onFocus');
    // Tab from the title to the chip beside it: one blur, then one focus.
    await send('onBlur');
    await send('onFocus');
    await settle();

    expect(onLeave).not.toHaveBeenCalled();
  });

  it('says focus left when it leaves after moving about inside', async () => {
    const onLeave = jest.fn();
    await render(<Group onLeave={onLeave} />);

    await send('onFocus');
    await send('onBlur');
    await send('onFocus');
    await settle();
    await send('onBlur');
    await settle();

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('says focus left once for two blurs with no focus between them', async () => {
    const onLeave = jest.fn();
    await render(<Group onLeave={onLeave} />);

    await send('onBlur');
    await send('onBlur');
    await settle();

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('calls the handler of the latest render', async () => {
    const first = jest.fn();
    const latest = jest.fn();
    const view = await render(<Group onLeave={first} />);
    await view.rerender(<Group onLeave={latest} />);

    await send('onBlur');
    await settle();

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('says nothing after the group itself has gone', async () => {
    const onLeave = jest.fn();
    const view = await render(<Group onLeave={onLeave} />);

    await send('onBlur');
    await view.unmount();
    await settle();

    expect(onLeave).not.toHaveBeenCalled();
  });
});
