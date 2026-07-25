import type { AuthHeroScreen } from './authHero';

type AuthHeroPlaceholderProps = {
  screen: AuthHeroScreen;
  className?: string;
};

/**
 * CSS/SVG stand-in until generated hero images are added.
 * Replace the inner frame with an <img> when assets land.
 */
export function AuthHeroPlaceholder({
  screen,
  className = '',
}: AuthHeroPlaceholderProps) {
  const accent = '#A78BFA';
  const accent2 = '#5EEAD4';

  return (
    <div
      className={`relative flex h-full min-h-[280px] w-full items-center justify-center overflow-hidden rounded-3xl ${className}`}
      style={{
        background:
          'linear-gradient(145deg, #0F172A 0%, #1e1b4b 45%, #0F766E 100%)',
      }}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(124,58,237,0.35), transparent 40%), radial-gradient(circle at 80% 70%, rgba(15,118,110,0.35), transparent 45%)',
        }}
      />
      <div className="relative z-10 flex aspect-[4/5] w-[70%] max-w-sm flex-col items-center justify-center gap-5 rounded-2xl border border-white/20 bg-white/10 p-8 shadow-xl backdrop-blur-sm">
        <HeroGlyph screen={screen} accent={accent} accent2={accent2} />
        <div className="text-center text-slate-50">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em]"
            style={{ color: accent2 }}
          >
            Placeholder art
          </p>
          <p className="mt-1 text-sm text-slate-50/80">
            Swap with generated image later
          </p>
        </div>
      </div>
    </div>
  );
}

function HeroGlyph({
  screen,
  accent,
  accent2,
}: {
  screen: AuthHeroScreen;
  accent: string;
  accent2: string;
}) {
  const common = {
    width: 96,
    height: 96,
    viewBox: '0 0 96 96',
    fill: 'none' as const,
  };

  switch (screen) {
    case 'login':
      return (
        <svg {...common}>
          <rect
            x="22"
            y="14"
            width="52"
            height="68"
            rx="12"
            stroke={accent}
            strokeWidth="3"
          />
          <circle cx="48" cy="42" r="12" fill={accent2} opacity="0.9" />
          <path
            d="M42 42l4 4 8-8"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <rect
            x="36"
            y="62"
            width="24"
            height="6"
            rx="3"
            fill={accent}
            opacity="0.5"
          />
        </svg>
      );
    case 'signup':
      return (
        <svg {...common}>
          <path
            d="M48 12l22 8v18c0 16-10 30-22 36-12-6-22-20-22-36V20l22-8z"
            stroke={accent}
            strokeWidth="3"
            fill={`${accent}22`}
          />
          <path
            d="M38 46l7 7 14-14"
            stroke={accent2}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'forgot':
      return (
        <svg {...common}>
          <rect
            x="28"
            y="40"
            width="40"
            height="32"
            rx="8"
            fill={`${accent}33`}
            stroke={accent}
            strokeWidth="3"
          />
          <path
            d="M36 40v-8a12 12 0 0124 0v8"
            stroke={accent2}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="48" cy="56" r="4" fill={accent2} />
        </svg>
      );
    case 'check-email':
    case 'verify':
      return (
        <svg {...common}>
          <rect
            x="16"
            y="28"
            width="64"
            height="44"
            rx="10"
            stroke={accent}
            strokeWidth="3"
            fill={`${accent}18`}
          />
          <path
            d="M20 34l28 20 28-20"
            stroke={accent2}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx="70"
            cy="30"
            r="12"
            fill={screen === 'verify' ? accent2 : accent}
          />
          <path
            d="M65 30l3.5 3.5 7-7"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'set-password':
      return (
        <svg {...common}>
          <rect
            x="14"
            y="30"
            width="68"
            height="40"
            rx="10"
            stroke={accent}
            strokeWidth="3"
            fill={`${accent}18`}
          />
          <rect x="34" y="42" width="28" height="16" rx="4" fill={accent2} />
          <circle cx="48" cy="50" r="3" fill="white" />
          <path
            d="M48 53v4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}
