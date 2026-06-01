'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type NavLink = { href: string; label: string };

type Props = {
  links: NavLink[];
  palette: {
    primary: string;
    surface: string;
    border: string;
    muted: string;
    secondary: string;
  };
};

export default function MobileMenu({ links, palette }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mo-mobile-nav"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors md:hidden"
        style={{
          borderColor: palette.border,
          color: palette.primary,
          background: 'transparent',
        }}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open ? (
        <div
          id="mo-mobile-nav"
          role="dialog"
          aria-modal="true"
          className="fixed inset-x-0 top-16 z-40 border-b md:hidden"
          style={{
            background: palette.surface,
            borderColor: palette.border,
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
          }}
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-black/5"
                style={{ color: palette.primary }}
              >
                {link.label}
              </a>
            ))}
            <div className="my-2 h-px" style={{ background: palette.border }} />
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-black/5"
              style={{ color: palette.muted }}
            >
              Login
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-lg px-3 py-3 text-center text-base font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: palette.primary }}
            >
              Get Started
            </Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}
