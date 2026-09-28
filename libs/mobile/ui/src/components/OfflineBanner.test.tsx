import React from 'react';
import { render, screen } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { ThemeProvider } from '../useTheme';
import { OfflineBanner } from './OfflineBanner';

jest.mock('@react-native-community/netinfo');

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider appearance="light">{children}</ThemeProvider>
);

describe('OfflineBanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NetInfo.addEventListener as jest.Mock).mockReturnValue(jest.fn());
  });

  describe('Rendering based on device state', () => {
    it('should render nothing when device is online', async () => {
      (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
        callback({ isConnected: true, isInternetReachable: true });
        return jest.fn();
      });
      await render(
        <TestWrapper>
          <OfflineBanner />
        </TestWrapper>,
      );
      expect(screen.queryByText(/Offline/)).not.toBeOnTheScreen();
    });

    it('should render banner when device is offline', async () => {
      (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
        callback({ isConnected: false, isInternetReachable: false });
        return jest.fn();
      });
      await render(
        <TestWrapper>
          <OfflineBanner />
        </TestWrapper>,
      );
      expect(
        await screen.findByText(
          /Offline — changes are saved on this device and sync later/,
        ),
      ).toBeTruthy();
    });

    it('should render banner when isConnected is false', async () => {
      (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
        callback({ isConnected: false, isInternetReachable: null });
        return jest.fn();
      });
      await render(
        <TestWrapper>
          <OfflineBanner />
        </TestWrapper>,
      );
      expect(
        await screen.findByText(
          /Offline — changes are saved on this device and sync later/,
        ),
      ).toBeTruthy();
    });

    it('should render banner when isInternetReachable is false', async () => {
      (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
        callback({ isConnected: true, isInternetReachable: false });
        return jest.fn();
      });
      await render(
        <TestWrapper>
          <OfflineBanner />
        </TestWrapper>,
      );
      expect(
        await screen.findByText(
          /Offline — changes are saved on this device and sync later/,
        ),
      ).toBeTruthy();
    });
  });

  describe('Explicit offline prop override', () => {
    it('should render when offline prop is true regardless of device', async () => {
      (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
        callback({ isConnected: true, isInternetReachable: true });
        return jest.fn();
      });
      await render(
        <TestWrapper>
          <OfflineBanner offline={true} />
        </TestWrapper>,
      );
      expect(
        await screen.findByText(
          /Offline — changes are saved on this device and sync later/,
        ),
      ).toBeTruthy();
    });

    it('should not render when offline prop is false regardless of device', async () => {
      (NetInfo.addEventListener as jest.Mock).mockImplementation((callback) => {
        callback({ isConnected: false, isInternetReachable: false });
        return jest.fn();
      });
      await render(
        <TestWrapper>
          <OfflineBanner offline={false} />
        </TestWrapper>,
      );
      expect(screen.queryByText(/Offline/)).not.toBeOnTheScreen();
    });
  });
});
