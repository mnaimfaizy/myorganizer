import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LandingSessionProvider } from './LandingSessionProvider';
import MobileMenu from './MobileMenu';

const palette = {
  primary: '#1d4ed8',
  surface: '#ffffff',
  border: '#e2e8f0',
  muted: '#64748b',
  secondary: '#0f172a',
};

const links = [{ href: '#features', label: 'Features' }];

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  return screen.getByRole('dialog');
}

describe('MobileMenu', () => {
  it('offers a single Open dashboard link when the landing session is kept', () => {
    render(
      <LandingSessionProvider view="session_kept">
        <MobileMenu links={links} palette={palette} />
      </LandingSessionProvider>,
    );

    const dialog = openMenu();

    expect(
      within(dialog).getByRole('link', { name: 'Open dashboard' }),
    ).toHaveAttribute('href', '/dashboard');
    expect(
      within(dialog).queryByRole('link', { name: 'Login' }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('link', { name: 'Get Started' }),
    ).not.toBeInTheDocument();
  });

  it('shows Login and Get Started when rendered without a landing session provider', () => {
    render(<MobileMenu links={links} palette={palette} />);

    const dialog = openMenu();

    expect(within(dialog).getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      within(dialog).getByRole('link', { name: 'Get Started' }),
    ).toHaveAttribute('href', '/signup');
    expect(
      within(dialog).queryByRole('link', { name: 'Open dashboard' }),
    ).not.toBeInTheDocument();
  });
});
