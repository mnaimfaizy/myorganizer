import {
  CheckSquare,
  CloudUpload,
  Lock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Youtube,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
  colorBorder,
  colorCard,
  colorCyan,
  colorMuted,
  colorPrimary,
  colorSecondary,
  colorSurface,
  colorSurfaceContainer,
  fontDisplay,
} from '@myorganizer/design-tokens';

import MobileMenu from './MobileMenu';
import Reveal from './Reveal';

const palette = {
  primary: colorPrimary,
  secondary: colorSecondary,
  cyan: colorCyan,
  surface: colorSurface,
  card: colorCard,
  border: colorBorder,
  muted: colorMuted,
  surfaceContainer: colorSurfaceContainer,
};

const fontStack = fontDisplay;

export default function LandingContent() {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: palette.surface,
        color: palette.primary,
        fontFamily: fontStack,
      }}
    >
      <AnimationStyles />
      <TopNav />
      <Hero />
      <Features />
      <Security />
      <Integrations />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function AnimationStyles() {
  const css = `
@media (prefers-reduced-motion: no-preference) {
  .mo-reveal {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.8s cubic-bezier(0.5, 0, 0, 1),
      transform 0.8s cubic-bezier(0.5, 0, 0, 1);
    will-change: opacity, transform;
  }
  .mo-reveal-active {
    opacity: 1;
    transform: translateY(0);
  }
  @keyframes mo-float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
    100% { transform: translateY(0px); }
  }
  .mo-animate-float {
    animation: mo-float 6s ease-in-out infinite;
  }
  @keyframes mo-shimmer {
    100% { transform: translateX(100%); }
  }
  .mo-btn-shimmer {
    position: relative;
    overflow: hidden;
    isolation: isolate;
  }
  .mo-btn-shimmer::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0,
      rgba(255, 255, 255, 0.2) 20%,
      rgba(255, 255, 255, 0.5) 60%,
      rgba(255, 255, 255, 0)
    );
    animation: mo-shimmer 2.5s infinite;
    pointer-events: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .mo-reveal { opacity: 1; transform: none; }
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

function TopNav() {
  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#security', label: 'Security' },
    { href: '#integrations', label: 'Pricing' },
  ];
  return (
    <nav
      className="sticky top-0 z-50 w-full border-b"
      style={{ background: palette.surface, borderColor: palette.border }}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight md:text-2xl"
            style={{ color: palette.primary }}
          >
            MyOrganizer
          </Link>
          <div className="hidden gap-4 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm transition-colors hover:opacity-80"
                style={{ color: palette.muted }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-semibold transition-colors hover:opacity-80 md:inline-block"
            style={{ color: palette.muted }}
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="mo-btn-shimmer hidden rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 md:inline-block"
            style={{ background: palette.primary }}
          >
            Get Started
          </Link>
          <MobileMenu
            links={navLinks}
            palette={{
              primary: palette.primary,
              surface: palette.surface,
              border: palette.border,
              muted: palette.muted,
              secondary: palette.secondary,
            }}
          />
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <Reveal
      as="header"
      className="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-4 py-12 md:flex-row md:px-6 md:py-20"
    >
      <div className="flex flex-1 flex-col items-start gap-4">
        <h1
          className="text-3xl font-bold leading-tight tracking-tight md:text-5xl"
          style={{ color: palette.primary, letterSpacing: '-0.02em' }}
        >
          Organize Your Life,
          <br />
          Secure Your Data.
        </h1>
        <p className="max-w-lg text-base" style={{ color: palette.muted }}>
          The all-in-one workspace for your tasks, addresses, and personal
          info—protected by client-side encryption.
        </p>
        <div className="mt-2 flex gap-4">
          <Link
            href="/signup"
            className="mo-btn-shimmer inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: palette.secondary }}
          >
            <Lock className="h-4 w-4" />
            Start Your Free Vault
          </Link>
        </div>
      </div>
      <div
        className="mo-animate-float relative flex w-full flex-1 overflow-hidden rounded-2xl border"
        style={{
          background: palette.card,
          borderColor: palette.border,
          boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.05)',
          aspectRatio: '1.79',
        }}
      >
        <Image
          src="/images/hero-vault.png"
          alt="Stylized encrypted vault dashboard with a glowing shield and lock"
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    </Reveal>
  );
}

type FeatureCard = {
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  span: 'sm' | 'lg';
  footer?: string;
};

function Features() {
  const cards: FeatureCard[] = [
    {
      title: 'Encrypted Todos',
      description:
        'Keep your list private. Plan your day without leaving a digital footprint.',
      icon: <CheckSquare className="h-5 w-5" />,
      accent: palette.cyan,
      span: 'lg',
      footer: 'Client-side encrypted',
    },
    {
      title: 'Secure Addresses',
      description: 'Safe storage for locations.',
      icon: <MapPin className="h-5 w-5" />,
      accent: palette.secondary,
      span: 'sm',
    },
    {
      title: 'Mobile Numbers',
      description: 'Manage your contacts securely.',
      icon: <Smartphone className="h-5 w-5" />,
      accent: palette.cyan,
      span: 'sm',
    },
    {
      title: 'Subscriptions',
      description: 'Never miss a renewal, kept under lock and key.',
      icon: <RefreshCw className="h-5 w-5" />,
      accent: palette.secondary,
      span: 'lg',
    },
  ];

  return (
    <Reveal
      as="section"
      id="features"
      className="border-y px-4 py-16 md:px-6"
      style={{ background: palette.card, borderColor: palette.border }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h2
            className="text-2xl font-semibold tracking-tight"
            style={{ color: palette.primary, letterSpacing: '-0.015em' }}
          >
            Vault-Backed Workspace
          </h2>
          <p className="mt-1 text-base" style={{ color: palette.muted }}>
            Everything you need, stored safely behind your master password.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <FeatureCardView key={c.title} card={c} />
          ))}
        </div>
      </div>
    </Reveal>
  );
}

function FeatureCardView({ card }: { card: FeatureCard }) {
  const spanClass = card.span === 'lg' ? 'md:col-span-2' : 'md:col-span-1';
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none ${spanClass}`}
      style={{
        background: palette.card,
        borderColor: palette.border,
        boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3
            className="text-lg font-semibold"
            style={{ color: palette.primary }}
          >
            {card.title}
          </h3>
          <span
            className="inline-flex items-center justify-center rounded-lg p-2"
            style={{
              color: card.accent,
              background: `${card.accent}1A`,
            }}
          >
            {card.icon}
          </span>
        </div>
        <p className="text-base" style={{ color: palette.muted }}>
          {card.description}
        </p>
      </div>
      {card.footer ? (
        <div
          className="mt-6 flex items-center gap-2 border-t pt-2 text-xs font-medium uppercase tracking-wide"
          style={{ color: palette.muted, borderColor: palette.border }}
        >
          <ShieldCheck className="h-4 w-4" />
          {card.footer}
        </div>
      ) : null}
    </div>
  );
}

function Security() {
  return (
    <Reveal
      as="section"
      id="security"
      className="px-4 py-16 md:px-6"
      style={{ background: palette.surface }}
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
        <div
          className="mb-2 rounded-full p-4"
          style={{ background: palette.border }}
        >
          <ShieldCheck className="h-8 w-8" style={{ color: palette.primary }} />
        </div>
        <h2
          className="text-3xl font-bold tracking-tight md:text-4xl"
          style={{ color: palette.primary, letterSpacing: '-0.02em' }}
        >
          Your Data, Your Keys.
        </h2>
        <p className="max-w-2xl text-base" style={{ color: palette.muted }}>
          MyOrganizer uses client-side encryption. We only see ciphertext; your
          sensitive data is decrypted only on your device. Your privacy is
          mathematically guaranteed.
        </p>
      </div>
    </Reveal>
  );
}

function Integrations() {
  return (
    <Reveal
      as="section"
      id="integrations"
      className="border-t px-4 py-16 md:px-6"
      style={{ background: palette.card, borderColor: palette.border }}
    >
      <div
        className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 rounded-2xl border p-6 md:flex-row"
        style={{
          background: palette.card,
          borderColor: palette.border,
          boxShadow: '0px 1px 3px rgba(15, 23, 42, 0.05)',
        }}
      >
        <div className="flex-1">
          <h3
            className="mb-1 text-2xl font-semibold tracking-tight"
            style={{ color: palette.primary, letterSpacing: '-0.015em' }}
          >
            Seamless Integrations
          </h3>
          <p className="text-base" style={{ color: palette.muted }}>
            Backup your encrypted vault to Google Drive and connect with YouTube
            easily.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <IntegrationPill
            icon={<CloudUpload className="h-4 w-4" />}
            label="Google Drive"
          />
          <IntegrationPill
            icon={<Youtube className="h-4 w-4" />}
            label="YouTube"
          />
        </div>
      </div>
    </Reveal>
  );
}

function IntegrationPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-lg border px-4 py-2"
      style={{
        background: palette.surfaceContainer,
        borderColor: palette.border,
        color: palette.muted,
      }}
    >
      <span style={{ color: palette.muted }}>{icon}</span>
      <span
        className="text-sm font-semibold"
        style={{ color: palette.primary }}
      >
        {label}
      </span>
    </div>
  );
}

function FinalCTA() {
  return (
    <Reveal
      as="section"
      className="px-4 py-20 text-center"
      style={{ background: palette.primary, color: '#FFFFFF' }}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
        <h2
          className="text-3xl font-bold tracking-tight md:text-4xl"
          style={{ letterSpacing: '-0.02em' }}
        >
          Take Control of Your Privacy Today.
        </h2>
        <Link
          href="/signup"
          className="mo-btn-shimmer mt-2 rounded-lg px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: palette.secondary }}
        >
          Create Your Account
        </Link>
      </div>
    </Reveal>
  );
}

function Footer() {
  const links = [
    'Features',
    'Security',
    'Pricing',
    'Privacy Policy',
    'Terms of Service',
    'Support',
  ];
  return (
    <footer
      className="w-full border-t"
      style={{
        background: palette.surfaceContainer,
        borderColor: palette.border,
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 py-12 md:flex-row md:px-6">
        <div className="flex flex-col items-center gap-1 md:items-start">
          <span
            className="text-lg font-bold"
            style={{ color: palette.primary }}
          >
            MyOrganizer
          </span>
          <span
            className="text-xs uppercase tracking-wide"
            style={{ color: palette.muted }}
          >
            © {new Date().getFullYear()} MyOrganizer. Secure by design.
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {links.map((label) => (
            <a
              key={label}
              href="#"
              className="text-xs uppercase tracking-wide transition-colors hover:opacity-80"
              style={{ color: palette.muted }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
