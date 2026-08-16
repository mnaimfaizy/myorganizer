import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import YouTubeDataPrivacyClient from './YouTubeDataPrivacyClient';

jest.mock('@myorganizer/web-ui', () => ({
  Button: ({ children, asChild, ...props }: any) => {
    if (asChild) return children;
    return <button {...props}>{children}</button>;
  },
  Card: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

describe('YouTubeDataPrivacyClient', () => {
  it('should render the heading "How we store your YouTube data"', () => {
    render(<YouTubeDataPrivacyClient />);
    expect(
      screen.getByRole('heading', {
        name: /How we store your YouTube data/i,
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it('should render all seven privacy claims', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const listItems = container.querySelectorAll('li');
    expect(listItems).toHaveLength(7);
  });

  it('should render metadata-only claim', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';
    expect(text).toMatch(/metadata only/i);
    expect(text).toMatch(/titles.*thumbnails.*video IDs/);
    expect(text).toMatch(/never store the video files/i);
  });

  it('should render Watched is yes/no claim', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';
    expect(text).toMatch(/Watched.*simple yes\/no marker/i);
    expect(text).toMatch(/not a viewing history/i);
  });

  it('should render latest 100 Cached Uploads claim', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';
    expect(text).toMatch(/latest 100.*Cached Uploads/i);
  });

  it('should render 30-day disable retention claim', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';
    expect(text).toMatch(/disable a channel/i);
    expect(text).toMatch(/30 days/);
    expect(text).toMatch(/permanently deleted/i);
  });

  it('should render disconnect deletes all metadata claim', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';
    expect(text).toMatch(/Disconnecting.*YouTube account/i);
    expect(text).toMatch(/deletes all YouTube metadata/i);
  });

  it('should render Shorts Daily Budget browser-local claim', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';
    expect(text).toMatch(/Shorts Daily Budget/i);
    expect(text).toMatch(/tracked locally in your browser/i);
  });

  it('should render Vault/E2EE disclaimer', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';
    expect(text).toMatch(/YouTube metadata is not covered/i);
    expect(text).toMatch(/Vault or end-to-end encryption/i);
  });

  it('should ensure Vault disclaimer is the only occurrence of "not covered"', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';
    const matches = text.match(
      /not covered by MyOrganizer's Vault or end-to-end encryption/g,
    );
    expect(matches).toHaveLength(1);
  });

  it('should contain no other references to Vault or encryption outside the disclaimer', () => {
    const { container } = render(<YouTubeDataPrivacyClient />);
    const text = container.textContent || '';

    // Find the disclaimer sentence position
    const disclaimerIndex = text.indexOf(
      "This YouTube metadata is not covered by MyOrganizer's Vault or end-to-end encryption",
    );
    expect(disclaimerIndex).toBeGreaterThan(-1);

    // Check text before the disclaimer
    const beforeDisclaimer = text.substring(0, disclaimerIndex);
    expect(beforeDisclaimer).not.toMatch(/Vault|encrypt/i);
  });

  it('should render a back button link to /dashboard/youtube', () => {
    render(<YouTubeDataPrivacyClient />);
    const backLink = screen.getByRole('link', { name: /Back to YouTube/i });
    expect(backLink).toHaveAttribute('href', '/dashboard/youtube');
  });
});
