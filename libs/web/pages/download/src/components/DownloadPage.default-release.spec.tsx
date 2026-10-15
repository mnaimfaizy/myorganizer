import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { DownloadPage } from './DownloadPage';

// babel-jest hoists this above the imports, so DownloadPage sees the mock.
jest.mock('../lib/mobileRelease', () => ({
  ...jest.requireActual('../lib/mobileRelease'),
  CURRENT_MOBILE_RELEASE: '9.9.9',
}));

describe('DownloadPage default version from CURRENT_MOBILE_RELEASE', () => {
  it('renders the release state for the current Mobile Release when no version is passed', () => {
    render(<DownloadPage />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'MyOrganiser 9.9.9 for Android',
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('android-release')).toBeInTheDocument();
    expect(screen.queryByTestId('android-no-release')).not.toBeInTheDocument();
    expect(screen.getByTestId('android-download-link')).toHaveAttribute(
      'href',
      'https://github.com/mnaimfaizy/myorganiser/releases/download/mobile-v9.9.9/myorganiser-9.9.9.apk',
    );
  });
});
