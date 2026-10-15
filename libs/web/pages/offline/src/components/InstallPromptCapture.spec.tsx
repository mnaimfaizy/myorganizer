/* eslint-disable import/first */
// The install-prompt listener lives in @myorganiser/web-ui. It is mocked at that
// module boundary so the test observes the one call this component makes,
// rather than the browser events the listener would capture.
const mockStartAppInstallCapture = jest.fn();

jest.mock('@myorganiser/web-ui', () => ({
  startAppInstallCapture: () => mockStartAppInstallCapture(),
}));

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { InstallPromptCapture } from './InstallPromptCapture';

describe('InstallPromptCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing to the DOM', () => {
    const { container } = render(<InstallPromptCapture />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should start the install-prompt capture exactly once on mount', () => {
    render(<InstallPromptCapture />);

    expect(mockStartAppInstallCapture).toHaveBeenCalledTimes(1);
    expect(mockStartAppInstallCapture).toHaveBeenCalledWith();
  });
});
