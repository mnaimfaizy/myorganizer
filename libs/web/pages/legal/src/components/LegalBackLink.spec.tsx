import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { LegalBackLink } from './LegalBackLink';

jest.mock('next/link', () => {
  return ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  );
});

function setHistoryLength(length: number) {
  Object.defineProperty(window.history, 'length', {
    configurable: true,
    get: () => length,
  });
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, 'referrer', {
    configurable: true,
    get: () => referrer,
  });
}

/**
 * Clicks the link and reports whether the click's default was prevented at the
 * moment the page-level listeners ran. The probe prevents default itself so a
 * fall-through click does not trigger jsdom's unimplemented navigation.
 */
function clickAndReadDefaultPrevented(link: HTMLElement): boolean | undefined {
  let defaultPrevented: boolean | undefined;
  const probe = (event: Event) => {
    defaultPrevented = event.defaultPrevented;
    event.preventDefault();
  };
  window.addEventListener('click', probe);
  try {
    fireEvent.click(link);
  } finally {
    window.removeEventListener('click', probe);
  }
  return defaultPrevented;
}

describe('LegalBackLink', () => {
  let historyBack: jest.SpyInstance;

  beforeEach(() => {
    historyBack = jest
      .spyOn(window.history, 'back')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (window.history as { length?: number }).length;
    delete (document as { referrer?: string }).referrer;
  });

  it('links to / and, with a same-origin referrer and history, goes back once and prevents the default', () => {
    setHistoryLength(3);
    setReferrer(`${window.location.origin}/account`);
    render(<LegalBackLink />);

    const link = screen.getByRole('link', { name: 'Back' });
    expect(link).toHaveAttribute('href', '/');

    expect(clickAndReadDefaultPrevented(link)).toBe(true);
    expect(historyBack).toHaveBeenCalledTimes(1);
  });

  it('falls through to / without going back when there is no referrer', () => {
    setHistoryLength(3);
    setReferrer('');
    render(<LegalBackLink />);

    const link = screen.getByRole('link', { name: 'Back' });

    expect(clickAndReadDefaultPrevented(link)).toBe(false);
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('falls through to / without going back when there is only one history entry', () => {
    setHistoryLength(1);
    setReferrer(`${window.location.origin}/account`);
    render(<LegalBackLink />);

    const link = screen.getByRole('link', { name: 'Back' });

    expect(clickAndReadDefaultPrevented(link)).toBe(false);
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('falls through to / without going back when the referrer is cross-origin', () => {
    setHistoryLength(3);
    setReferrer('https://other.example/page');
    render(<LegalBackLink />);

    const link = screen.getByRole('link', { name: 'Back' });

    expect(clickAndReadDefaultPrevented(link)).toBe(false);
    expect(historyBack).not.toHaveBeenCalled();
  });
});
