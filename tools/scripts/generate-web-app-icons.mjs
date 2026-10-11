/**
 * Generates the web app's installable icons from the AppLogo shield and the
 * design-token build.
 * Usage: yarn web:app-icons:generate
 *
 * The icon has one source and it is not in this file: the shield and check
 * paths are read out of the exported `SHIELD_PATH` / `CHECK_PATH` /
 * `CHECK_STROKE_WIDTH` constants in
 * libs/web/ui/src/lib/components/AppLogo/AppLogo.tsx, and every colour out of
 * the design-token build. This script only decides how the mark sits on each
 * icon's canvas, and fails if it cannot find a value it reads.
 *
 * Writes apps/myorganizer/public/icons/:
 * - icon-192.png, icon-512.png — transparent "any"-purpose icons, the shield
 *   at the same proportions as the existing favicon.
 * - icon-512-maskable.png — opaque full-bleed background with the shield kept
 *   inside the maskable-icon safe zone (a centred circle, 40% of the icon's
 *   radius per the Web App Manifest spec; this script targets 36% for margin).
 * - apple-touch-icon.png — opaque full-bleed background, 180 × 180, the size
 *   iOS expects for a Home Screen icon.
 *
 * Re-run it after the shield or a Brand Primitive changes, and commit the
 * output. Rasterising goes through `sharp`, not a browser: every icon here is
 * a flat shape plus a linear gradient, which `sharp`'s SVG rasteriser renders
 * exactly, so there is no reason to pay for Chromium as
 * generate-mobile-app-icon.mjs and generate-og-image.mjs do.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromRoot = (path) => resolve(repoRoot, path);

const APP_LOGO = 'libs/web/ui/src/lib/components/AppLogo/AppLogo.tsx';
const TOKENS = 'libs/design-tokens/src/generated/tokens.ts';
const ICONS_DIR = 'apps/myorganizer/public/icons';

function readOrFail(path, pattern, what) {
  const match = readFileSync(fromRoot(path), 'utf8').match(pattern);
  if (!match) {
    throw new Error(`Could not read ${what} from ${path}`);
  }
  return match[1];
}

const token = (name) =>
  readOrFail(
    TOKENS,
    new RegExp(`export const ${name} = "(#[0-9a-fA-F]{6})"`),
    name,
  );

// The mark, in AppLogo's own 32 × 32 viewBox — read by name, not by position,
// so reordering or restyling AppLogo's JSX can't silently bind these to the
// wrong path.
const shieldPath = readOrFail(
  APP_LOGO,
  /export const SHIELD_PATH = '([^']+)';/,
  'the shield path',
);
const checkPath = readOrFail(
  APP_LOGO,
  /export const CHECK_PATH = '([^']+)';/,
  'the check path',
);
const checkStrokeWidth = Number(
  readOrFail(
    APP_LOGO,
    /export const CHECK_STROKE_WIDTH = (\d+(?:\.\d+)?);/,
    'the check stroke width',
  ),
);

const brand = {
  gradientTop: token('colorSecondary'),
  gradientBottom: token('colorTertiary'),
  check: token('colorOnSecondary'),
  plate: token('colorSurface'),
};

// The shield's bounding box in that viewBox: x 4–28, y 3–31.
const SHIELD = { centerX: 16, centerY: 17, top: 3, right: 28, height: 28 };
// Farthest a shield corner sits from its own centre — the top corners, not
// the pointed base.
const SHIELD_CORNER_RADIUS = Math.hypot(
  SHIELD.right - SHIELD.centerX,
  SHIELD.top - SHIELD.centerY,
);

/**
 * One icon as SVG.
 * - `plain`: transparent canvas, the shield at the same scale the existing
 *   favicon uses (fills almost the whole square).
 * - `plated`: an opaque full-bleed background, the shield scaled down so its
 *   farthest corner stays inside `safeZoneFraction` of the canvas radius.
 */
function iconSvg({ size, variant, safeZoneFraction }) {
  const scale =
    variant === 'plain'
      ? size / 32
      : (size * safeZoneFraction) / SHIELD_CORNER_RADIUS;
  const round = (value) => Number(value.toFixed(3));
  const translateX = round(size / 2 - SHIELD.centerX * scale);
  const translateY = round(size / 2 - SHIELD.centerY * scale);

  const background =
    variant === 'plain'
      ? ''
      : `<rect x="0" y="0" width="${size}" height="${size}" fill="${brand.plate}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${brand.gradientTop}"/>
      <stop offset="1" stop-color="${brand.gradientBottom}"/>
    </linearGradient>
  </defs>
  ${background}
  <g transform="translate(${translateX} ${translateY}) scale(${round(scale)})">
    <path d="${shieldPath}" fill="url(#shield)"/>
    <path d="${checkPath}" fill="none" stroke="${brand.check}" stroke-width="${checkStrokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;
}

const ICONS = [
  { filename: 'icon-192.png', size: 192, variant: 'plain' },
  { filename: 'icon-512.png', size: 512, variant: 'plain' },
  // Web App Manifest spec: a maskable icon's safe zone is a centred circle
  // of 40% of the icon's radius. Target 36% to leave margin under that cap.
  {
    filename: 'icon-512-maskable.png',
    size: 512,
    variant: 'plated',
    safeZoneFraction: 0.36,
  },
  // Apple's Home Screen icon size; iOS rounds the corners itself.
  {
    filename: 'apple-touch-icon.png',
    size: 180,
    variant: 'plated',
    safeZoneFraction: 0.4,
  },
];

function write(path, content) {
  mkdirSync(dirname(fromRoot(path)), { recursive: true });
  writeFileSync(fromRoot(path), content);
  console.log(`✓ ${path}`);
}

for (const { filename, size, variant, safeZoneFraction } of ICONS) {
  const svg = iconSvg({ size, variant, safeZoneFraction });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  write(`${ICONS_DIR}/${filename}`, png);
}
