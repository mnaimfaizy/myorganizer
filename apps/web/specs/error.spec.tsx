import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GlobalError from '../src/app/error';

const LEAK_PROBE_MESSAGE = 'upstream-probe-4417 internal detail';

describe('GlobalError', () => {
  const renderError = (reset: () => void = jest.fn()) =>
    render(<GlobalError error={new Error(LEAK_PROBE_MESSAGE)} reset={reset} />);

  it('renders the "Something went wrong" title', () => {
    renderError();

    // CardTitle renders a <div> with no heading role, so match by text.
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('offers an in-app link back to the dashboard', () => {
    renderError();

    const link = screen.getByRole('link', { name: 'Go to dashboard' });
    expect(link.getAttribute('href')).toBe('/dashboard');
  });

  it('calls reset exactly once when "Try again" is clicked', () => {
    const reset = jest.fn();
    renderError(reset);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('does not render the error message in the document', () => {
    const { container } = renderError();

    expect(container.textContent).not.toContain(LEAK_PROBE_MESSAGE);
    expect(document.body.textContent).not.toContain('upstream-probe-4417');
  });
});
