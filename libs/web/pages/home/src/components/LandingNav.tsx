import {
  colorBorderVar,
  colorMutedVar,
  colorPrimary,
  colorSurface,
  colorSecondary,
  colorBorder,
  colorMuted,
  shadowPopover,
} from '@myorganiser/design-tokens';
import { AppLogo } from '@myorganiser/web-ui';
import Link from 'next/link';

import { NAV_LINKS } from '../content/landingCopy';
import { LandingNavActions } from './LandingNavActions';
import MobileMenu from './MobileMenu';

/** The floating top bar: logo, section anchors, and the auth actions. */
export function LandingNav() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 top-2 z-50 px-3">
      <div
        className="mx-auto flex h-14 max-w-5xl items-center justify-between rounded-2xl border bg-white/85 px-3 pl-5 backdrop-blur-md"
        style={{ borderColor: colorBorderVar, boxShadow: shadowPopover }}
      >
        <Link href="/" aria-label="MyOrganiser home">
          <AppLogo variant="full" height={26} aria-hidden />
        </Link>
        <div className="hidden gap-6 text-sm font-medium md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-opacity hover:opacity-70"
              style={{ color: colorMutedVar }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LandingNavActions />
          <MobileMenu
            links={NAV_LINKS}
            palette={{
              primary: colorPrimary,
              surface: colorSurface,
              border: colorBorder,
              muted: colorMuted,
              secondary: colorSecondary,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
