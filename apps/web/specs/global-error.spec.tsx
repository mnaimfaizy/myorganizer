import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GlobalError from '../src/app/global-error';

const LEAK_PROBE_MESSAGE = 'root-layout-probe-7731 user detail';
const LEAK_PROBE_DIGEST = 'digest-probe-9042';

describe('GlobalError', () => {
  // The component supplies its own <html> and <body>, so it is rendered into
  // the document root rather than a nested <div>, which would trigger React's
  // DOM-nesting warnings.
  const renderError = (
    retry: () => void = jest.fn(),
    error: Error & { digest?: string } = new Error(LEAK_PROBE_MESSAGE),
  ) =>
    render(<GlobalError error={error} retry={retry} />, {
      container: document,
    });

  it('renders the "Something went wrong" title', () => {
    renderError();

    // CardTitle renders a <div> with no heading role, so match by text.
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('offers a full-document link back to the dashboard', () => {
    renderError();

    const link = screen.getByRole('link', { name: 'Go to dashboard' });
    expect(link.getAttribute('href')).toBe('/dashboard');
  });

  it('calls retry exactly once when "Try again" is clicked', () => {
    const retry = jest.fn();
    renderError(retry);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('does not render the error message in the document', () => {
    renderError();

    expect(document.documentElement.textContent).not.toContain(
      'root-layout-probe-7731',
    );
  });

  it('does not render the error digest in the document', () => {
    const error = Object.assign(new Error('boom'), {
      digest: LEAK_PROBE_DIGEST,
    });
    renderError(jest.fn(), error);

    expect(document.documentElement.textContent).not.toContain(
      LEAK_PROBE_DIGEST,
    );
  });
});
