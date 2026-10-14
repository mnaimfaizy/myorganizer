import '@testing-library/jest-dom';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { InstallAppInstructions } from './InstallAppInstructions';

describe('InstallAppInstructions', () => {
  it('should call onInstall once when the install button is clicked in prompt mode', () => {
    const onInstall = jest.fn();
    render(<InstallAppInstructions mode="prompt" onInstall={onInstall} />);

    fireEvent.click(screen.getByRole('button', { name: 'Install app' }));

    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('should show no step list when in prompt mode', () => {
    render(<InstallAppInstructions mode="prompt" onInstall={jest.fn()} />);

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('should list the Share and Add to Home Screen steps with their More-menu fallbacks when in ios mode', () => {
    render(<InstallAppInstructions mode="ios" onInstall={jest.fn()} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // The sr-only "the More button" is the accessible text for the aria-hidden
    // ••• glyph, so this pattern also asserts the screen-reader wording.
    expect(items[0].textContent).toMatch(
      /^Tap the Share button\s*\.\s*If it isn't in Safari's toolbar, tap\s*•••\s*the More button first\.$/,
    );
    expect(items[1].textContent).toBe(
      "Choose Add to Home Screen. If it isn't listed, tap More first.",
    );
  });

  it('should show the sign-in and vault unlock note with no install button and no onInstall call when in ios mode', () => {
    const onInstall = jest.fn();
    render(<InstallAppInstructions mode="ios" onInstall={onInstall} />);

    expect(
      screen.getByText(
        "You'll sign in and unlock your vault again inside the installed app.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
    expect(onInstall).not.toHaveBeenCalled();
  });

  it('should list the File menu and Add to Dock steps when in mac-safari mode', () => {
    render(<InstallAppInstructions mode="mac-safari" onInstall={jest.fn()} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe(
      "Open the File menu in Safari's menu bar.",
    );
    expect(items[1].textContent).toBe('Choose Add to Dock.');
  });

  it('should show the sign-in and vault unlock note with no install button and no onInstall call when in mac-safari mode', () => {
    const onInstall = jest.fn();
    render(<InstallAppInstructions mode="mac-safari" onInstall={onInstall} />);

    expect(
      screen.getByText(
        "You'll sign in and unlock your vault again inside the installed app.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Install app' }),
    ).not.toBeInTheDocument();
    expect(onInstall).not.toHaveBeenCalled();
  });

  it('should never use the term PWA in copy in any mode', () => {
    const { container, unmount } = render(
      <InstallAppInstructions mode="prompt" onInstall={jest.fn()} />,
    );
    expect(container.textContent).not.toMatch(/pwa/i);
    unmount();

    const ios = render(
      <InstallAppInstructions mode="ios" onInstall={jest.fn()} />,
    );
    expect(ios.container.textContent).not.toMatch(/pwa/i);
    ios.unmount();

    const macSafari = render(
      <InstallAppInstructions mode="mac-safari" onInstall={jest.fn()} />,
    );
    expect(macSafari.container.textContent).not.toMatch(/pwa/i);
  });

  it('should merge className onto the root and forward the ref to it', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <InstallAppInstructions
        ref={ref}
        mode="prompt"
        onInstall={jest.fn()}
        className="custom-root"
      />,
    );

    expect(ref.current).toBe(container.firstElementChild);
    expect(ref.current?.classList.contains('custom-root')).toBe(true);
    expect(ref.current?.classList.contains('space-y-4')).toBe(true);
  });
});
