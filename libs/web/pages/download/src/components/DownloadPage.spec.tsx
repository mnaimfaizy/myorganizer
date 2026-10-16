import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import { CURRENT_MOBILE_RELEASE } from '../lib/mobileRelease';
import { DownloadPage } from './DownloadPage';

const RELEASE_VERSION = '1.2.3';
const APK_URL =
  'https://github.com/mnaimfaizy/myorganiser/releases/download/mobile-v1.2.3/myorganiser-1.2.3.apk';
const CHECKSUM_URL = `${APK_URL}.sha256`;
const RELEASE_NOTES_URL =
  'https://github.com/mnaimfaizy/myorganiser/releases/tag/mobile-v1.2.3';

describe('DownloadPage', () => {
  describe('with a Mobile Release', () => {
    it('shows the Android heading and release section for that version', () => {
      render(<DownloadPage version={RELEASE_VERSION} />);

      expect(
        screen.getByRole('heading', {
          level: 2,
          name: 'MyOrganiser 1.2.3 for Android',
        }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('android-release')).toBeInTheDocument();
      expect(
        screen.queryByTestId('android-no-release'),
      ).not.toBeInTheDocument();
    });

    it('links the APK download to the pinned GitHub Release asset', () => {
      render(<DownloadPage version={RELEASE_VERSION} />);

      expect(screen.getByTestId('android-download-link')).toHaveAttribute(
        'href',
        APK_URL,
      );
    });

    it('links the SHA-256 checksum next to the APK', () => {
      render(<DownloadPage version={RELEASE_VERSION} />);

      expect(screen.getByTestId('android-checksum-link')).toHaveAttribute(
        'href',
        CHECKSUM_URL,
      );
    });

    it('links the GitHub release notes and marks external links noopener', () => {
      render(<DownloadPage version={RELEASE_VERSION} />);

      const notes = screen.getByRole('link', {
        name: 'Release notes on GitHub',
      });
      expect(notes).toHaveAttribute('href', RELEASE_NOTES_URL);

      for (const link of [
        screen.getByTestId('android-download-link'),
        screen.getByTestId('android-checksum-link'),
        notes,
      ]) {
        expect(link.getAttribute('rel')).toContain('noopener');
      }
    });

    it('lists the install steps for the APK', () => {
      render(<DownloadPage version={RELEASE_VERSION} />);

      const release = screen.getByTestId('android-release');
      expect(within(release).getByText('To install it')).toBeInTheDocument();
      expect(within(release).getAllByRole('listitem')).toHaveLength(3);
    });
  });

  describe('before the first Mobile Release', () => {
    it('explains that no Android release exists yet and offers no APK links', () => {
      render(<DownloadPage version={null} />);

      expect(screen.getByTestId('android-no-release')).toBeInTheDocument();
      expect(screen.queryByTestId('android-release')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('android-download-link'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('android-checksum-link'),
      ).not.toBeInTheDocument();
    });

    it('points only at the web app, with no GitHub link on the page', () => {
      render(<DownloadPage version={null} />);

      const links = screen.getAllByRole('link');
      for (const link of links) {
        expect(link.getAttribute('href')).not.toMatch(/github\.com/);
      }

      const webApp = screen.getByTestId('android-no-release');
      expect(
        within(webApp).getByRole('link', { name: 'Open the web app' }),
      ).toHaveAttribute('href', '/');
    });
  });

  describe('iPhone and iPad steps', () => {
    it('shows the Add to Home Screen steps with no download link when a release exists', () => {
      render(<DownloadPage version={RELEASE_VERSION} />);

      const ios = screen.getByTestId('ios-install');
      expect(
        within(ios).getByRole('heading', { level: 2, name: 'iPhone and iPad' }),
      ).toBeInTheDocument();
      expect(
        within(ios).getByText(/Choose Add to Home Screen/),
      ).toBeInTheDocument();
      expect(within(ios).queryByRole('link')).not.toBeInTheDocument();
    });

    it('shows the same Add to Home Screen steps before the first release', () => {
      render(<DownloadPage version={null} />);

      const ios = screen.getByTestId('ios-install');
      expect(
        within(ios).getByText(/Choose Add to Home Screen/),
      ).toBeInTheDocument();
      expect(within(ios).queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('default version', () => {
    it('renders the state matching CURRENT_MOBILE_RELEASE when no version is passed', () => {
      render(<DownloadPage />);

      expect(screen.queryByTestId('android-release') !== null).toBe(
        CURRENT_MOBILE_RELEASE !== null,
      );
      expect(screen.queryByTestId('android-no-release') !== null).toBe(
        CURRENT_MOBILE_RELEASE === null,
      );
      if (CURRENT_MOBILE_RELEASE !== null) {
        expect(
          screen.getByRole('heading', {
            level: 2,
            name: `MyOrganiser ${CURRENT_MOBILE_RELEASE} for Android`,
          }),
        ).toBeInTheDocument();
      }
    });
  });
});
