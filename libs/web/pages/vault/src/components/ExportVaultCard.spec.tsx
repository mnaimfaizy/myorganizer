/* eslint-disable import/first -- jest.mock must precede application imports */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * Mock the hooks from ../hooks before importing ExportVaultCard.
 */
jest.mock('../hooks', () => ({
  useExportVault: jest.fn(),
  useVaultDisabledState: jest.fn(),
}));

/**
 * Mock web-ui components.
 */
jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, onClick, disabled, 'data-testid': testId }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid={testId}>
      {children}
    </button>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

import { ExportVaultCard } from './ExportVaultCard';
import { useExportVault, useVaultDisabledState } from '../hooks';

describe('ExportVaultCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');
    (useExportVault as jest.Mock).mockReturnValue({
      exporting: false,
      exportVaultNow: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Disabled state handling', () => {
    test('B1: signed-out state disables button and shows unavailability reason', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('signed-out');

      render(<ExportVaultCard />);

      expect(screen.getByTestId('export-vault-button')).toBeDisabled();
      expect(
        screen.getByTestId('export-vault-unavailable'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Your vault is not available on this device right now.',
        ),
      ).toBeInTheDocument();
    });

    test('B2: no-local-vault state disables button and shows correct unavailability reason', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('no-local-vault');

      render(<ExportVaultCard />);

      expect(screen.getByTestId('export-vault-button')).toBeDisabled();
      expect(
        screen.getByTestId('export-vault-unavailable'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('There is no vault on this device to export.'),
      ).toBeInTheDocument();
    });

    test('B3: locked state enables button (export does not need Master Key per ADR 0068)', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('locked');

      render(<ExportVaultCard />);

      const button = screen.getByTestId('export-vault-button');
      expect(button).not.toBeDisabled();
      expect(
        screen.queryByTestId('export-vault-unavailable'),
      ).not.toBeInTheDocument();
    });

    test('B4: enabled state enables button and no unavailability paragraph', () => {
      (useVaultDisabledState as jest.Mock).mockReturnValue('enabled');

      render(<ExportVaultCard />);

      expect(screen.getByTestId('export-vault-button')).not.toBeDisabled();
      expect(
        screen.queryByTestId('export-vault-unavailable'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Export action', () => {
    test('B5: enabled state + click calls exportVaultNow once', async () => {
      const mockExportVaultNow = jest.fn();
      (useExportVault as jest.Mock).mockReturnValue({
        exporting: false,
        exportVaultNow: mockExportVaultNow,
      });

      render(<ExportVaultCard />);

      const button = screen.getByTestId('export-vault-button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockExportVaultNow).toHaveBeenCalledTimes(1);
      });
    });

    test('B6: no-local-vault state + attempted click does not call exportVaultNow (control is genuinely unreachable)', () => {
      const mockExportVaultNow = jest.fn();
      (useVaultDisabledState as jest.Mock).mockReturnValue('no-local-vault');
      (useExportVault as jest.Mock).mockReturnValue({
        exporting: false,
        exportVaultNow: mockExportVaultNow,
      });

      render(<ExportVaultCard />);

      const button = screen.getByTestId('export-vault-button');
      expect(button).toBeDisabled();

      // Try to click anyway (simulate disabled state preventing click)
      fireEvent.click(button);

      // exportVaultNow should not have been called
      expect(mockExportVaultNow).not.toHaveBeenCalled();
    });
  });
});
