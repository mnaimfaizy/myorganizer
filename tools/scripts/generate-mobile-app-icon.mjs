/**
 * Generates the mobile app icon for iOS and Android from the BrandMark shield.
 * Usage: yarn mobile:app-icon:generate
 *
 * The icon has one source and it is not in this file: the shield and check
 * paths are read out of libs/mobile/ui/src/components/BrandMark.tsx, and every
 * colour out of the design-token build. This script only decides how the mark
 * sits on each platform's canvas, and fails if it cannot find a value it reads.
 *
 * Writes:
 * - apps/mobile/app-icon/*.svg — the 1024 × 1024 masters (light, dark, tinted).
 * - iOS AppIcon.appiconset — one 1024 PNG per appearance plus Contents.json;
 *   Xcode derives every size from them.
 * - Android adaptive icon — foreground and monochrome vector drawables, the
 *   background colour, and the mipmap-anydpi-v26 entries.
 * - Android legacy mipmap PNGs, for API 24–25, which predate adaptive icons.
 *
 * Re-run it after the shield or a Brand Primitive changes, and commit the
 * output. Rasterising goes through Playwright's Chromium, as
 * generate-og-image.mjs does.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fromRoot = (path) => resolve(repoRoot, path);

const BRAND_MARK = 'libs/mobile/ui/src/components/BrandMark.tsx';
const TOKENS = 'libs/design-tokens/src/generated/tokens.ts';
const ROLES = 'libs/design-tokens/src/generated/roles.ts';
const MASTERS = 'apps/mobile/app-icon';
const APP_ICON_SET =
  'apps/mobile/ios/Mobile/Images.xcassets/AppIcon.appiconset';
const ANDROID_RES = 'apps/mobile/android/app/src/main/res';

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
const backgroundRole = (mode) =>
  readOrFail(
    ROLES,
    new RegExp(`export const ${mode} = \\{\\s*background: "(#[0-9a-fA-F]{6})"`),
    `${mode}.background`,
  );

// The mark, in BrandMark's own 32 × 32 viewBox.
const shieldPath = readOrFail(BRAND_MARK, /d="(M[^"]+Z)"/, 'the shield path');
const checkPath = readOrFail(BRAND_MARK, /d="(M[^"Z]+)"/, 'the check path');
const checkStrokeWidth = Number(
  readOrFail(BRAND_MARK, /strokeWidth=\{(\d+(?:\.\d+)?)\}/, 'the check width'),
);
// The shield's bounding box in that viewBox: x 4–28, y 3–31.
const SHIELD = { centerX: 16, centerY: 17, top: 3, bottom: 31, height: 28 };

const brand = {
  gradientTop: token('colorSecondary'),
  gradientBottom: token('colorTertiary'),
  check: token('colorOnSecondary'),
};
const lightBackground = backgroundRole('roleLight');
const darkBackground = backgroundRole('roleDark');

/**
 * How each appearance colours the mark and its plate. The shield keeps the
 * brand gradient in light and dark — it is the logo — and only the plate
 * follows the mode. Tinted is the greyscale image iOS recolours itself: it
 * reads luminance, so the gradient becomes white fading to grey on black.
 */
const APPEARANCES = {
  light: {
    plate: lightBackground,
    gradient: [brand.gradientTop, brand.gradientBottom],
    check: brand.check,
  },
  dark: {
    plate: darkBackground,
    gradient: [brand.gradientTop, brand.gradientBottom],
    check: brand.check,
  },
  tinted: {
    plate: '#000000',
    gradient: ['#ffffff', '#9ca3af'],
    check: '#000000',
  },
};

// The shield's height as a share of the plate it sits on.
const SHIELD_SHARE = 0.57;

/**
 * One icon as SVG. `plateShape` is `full` (iOS, which masks the corners
 * itself), or `rounded` / `circle` for the Android legacy icons, which carry
 * their own shape on a transparent canvas.
 */
function iconSvg({ size, appearance, plateShape }) {
  const { plate, gradient, check } = APPEARANCES[appearance];
  const inset = plateShape === 'full' ? 0 : size / 24;
  const plateSize = size - inset * 2;
  const scale = (plateSize * SHIELD_SHARE) / SHIELD.height;
  const round = (value) => Number(value.toFixed(3));
  const plateAttributes = {
    full: '',
    rounded: ` rx="${round(plateSize * 0.2)}"`,
    circle: ` rx="${round(plateSize / 2)}"`,
  }[plateShape];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${gradient[0]}"/>
      <stop offset="1" stop-color="${gradient[1]}"/>
    </linearGradient>
  </defs>
  <rect x="${round(inset)}" y="${round(inset)}" width="${round(plateSize)}" height="${round(plateSize)}"${plateAttributes} fill="${plate}"/>
  <g transform="translate(${round(size / 2 - SHIELD.centerX * scale)} ${round(size / 2 - SHIELD.centerY * scale)}) scale(${round(scale)})">
    <path d="${shieldPath}" fill="url(#shield)"/>
    <path d="${checkPath}" fill="none" stroke="${check}" stroke-width="${checkStrokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;
}

// ---------------------------------------------------------------- Android --

// An adaptive icon layer is 108dp; only the centre 66dp circle is guaranteed
// to survive the launcher's mask. At 1.5 the shield is 36 × 42dp and its
// corners sit 27.7dp from the centre, inside that circle's 33dp radius.
const ADAPTIVE = { viewport: 108, scale: 1.5 };

function vectorDrawable(paths) {
  const { viewport, scale } = ADAPTIVE;
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tools/scripts/generate-mobile-app-icon.mjs from the
     BrandMark shield. Do not edit; re-run yarn mobile:app-icon:generate. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="${viewport}dp"
    android:height="${viewport}dp"
    android:viewportWidth="${viewport}"
    android:viewportHeight="${viewport}">
    <group
        android:scaleX="${scale}"
        android:scaleY="${scale}"
        android:translateX="${viewport / 2 - SHIELD.centerX * scale}"
        android:translateY="${viewport / 2 - SHIELD.centerY * scale}">
${paths}
    </group>
</vector>
`;
}

const strokeAttributes = (width) => `android:strokeWidth="${width}"
            android:strokeLineCap="round"
            android:strokeLineJoin="round"`;

const foregroundDrawable = () =>
  vectorDrawable(`        <path android:pathData="${shieldPath}">
            <aapt:attr name="android:fillColor">
                <gradient
                    android:type="linear"
                    android:startX="${SHIELD.centerX}"
                    android:startY="${SHIELD.top}"
                    android:endX="${SHIELD.centerX}"
                    android:endY="${SHIELD.bottom}"
                    android:startColor="${brand.gradientTop.toUpperCase()}"
                    android:endColor="${brand.gradientBottom.toUpperCase()}" />
            </aapt:attr>
        </path>
        <path
            android:pathData="${checkPath}"
            android:strokeColor="${brand.check.toUpperCase()}"
            ${strokeAttributes(checkStrokeWidth)} />`);

// A themed icon is drawn by the launcher in one colour from this layer's
// alpha, so a filled shield would swallow the check. The shield is outlined
// instead, slightly lighter than the check it carries.
const monochromeDrawable = () =>
  vectorDrawable(`        <path
            android:pathData="${shieldPath}"
            android:strokeColor="#FFFFFF"
            ${strokeAttributes(2.5)} />
        <path
            android:pathData="${checkPath}"
            android:strokeColor="#FFFFFF"
            ${strokeAttributes(checkStrokeWidth)} />`);

const ADAPTIVE_ICON = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;

const launcherBackground = () => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- The light background Semantic Role, written by
         tools/scripts/generate-mobile-app-icon.mjs. It has no values-night
         twin on purpose: a launcher icon does not follow the colour mode. -->
    <color name="ic_launcher_background">${lightBackground.toUpperCase()}</color>
</resources>
`;

const LEGACY_DENSITIES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

// -------------------------------------------------------------------- iOS --

const IOS_SIZE = 1024;
const IOS_IMAGES = [
  { appearance: 'light', filename: 'AppIcon.png' },
  { appearance: 'dark', filename: 'AppIcon-Dark.png' },
  { appearance: 'tinted', filename: 'AppIcon-Tinted.png' },
];

const appIconContents = () =>
  `${JSON.stringify(
    {
      images: IOS_IMAGES.map(({ appearance, filename }) => ({
        ...(appearance !== 'light' && {
          appearances: [{ appearance: 'luminosity', value: appearance }],
        }),
        filename,
        idiom: 'universal',
        platform: 'ios',
        size: `${IOS_SIZE}x${IOS_SIZE}`,
      })),
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  )}\n`;

// -------------------------------------------------------------------- PNG --

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

/**
 * Re-encodes an 8-bit RGBA screenshot as RGB. App Store Connect rejects an
 * app icon that carries an alpha channel, and Chromium always writes one.
 */
function withoutAlpha(png) {
  let offset = PNG_SIGNATURE.length;
  let header;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = data;
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
  }
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const [bitDepth, colourType, , , interlace] = header.subarray(8);
  if (colourType === 2) return png;
  if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) {
    throw new Error('Expected an 8-bit, non-interlaced RGBA screenshot');
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgb = Buffer.alloc(height * (width * 3 + 1));
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = Buffer.from(
      raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
    );
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? row[x - 4] : 0;
      const up = previous[x];
      const upLeft = x >= 4 ? previous[x - 4] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const distLeft = Math.abs(estimate - left);
        const distUp = Math.abs(estimate - up);
        const distUpLeft = Math.abs(estimate - upLeft);
        if (distLeft <= distUp && distLeft <= distUpLeft) predicted = left;
        else predicted = distUp <= distUpLeft ? up : upLeft;
      }
      row[x] = (row[x] + predicted) & 0xff;
    }
    const out = y * (width * 3 + 1);
    for (let x = 0; x < width; x += 1) {
      if (row[x * 4 + 3] !== 255) {
        throw new Error('An iOS icon must be fully opaque');
      }
      row.copy(rgb, out + 1 + x * 3, x * 4, x * 4 + 3);
    }
    previous = row;
  }

  const rgbHeader = Buffer.from(header);
  rgbHeader[9] = 2;
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', rgbHeader),
    pngChunk('IDAT', deflateSync(rgb, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ write --

function write(path, content) {
  mkdirSync(dirname(fromRoot(path)), { recursive: true });
  writeFileSync(fromRoot(path), content);
  console.log(`✓ ${path}`);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const rasterise = async (svg, size) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
    );
    return page.screenshot({ type: 'png', omitBackground: true });
  };

  for (const { appearance, filename } of IOS_IMAGES) {
    const svg = iconSvg({ size: IOS_SIZE, appearance, plateShape: 'full' });
    write(`${MASTERS}/app-icon-${appearance}.svg`, svg);
    write(
      `${APP_ICON_SET}/${filename}`,
      withoutAlpha(await rasterise(svg, IOS_SIZE)),
    );
  }
  write(`${APP_ICON_SET}/Contents.json`, appIconContents());

  write(
    `${ANDROID_RES}/drawable/ic_launcher_foreground.xml`,
    foregroundDrawable(),
  );
  write(
    `${ANDROID_RES}/drawable/ic_launcher_monochrome.xml`,
    monochromeDrawable(),
  );
  write(
    `${ANDROID_RES}/values/ic_launcher_background.xml`,
    launcherBackground(),
  );
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    write(`${ANDROID_RES}/mipmap-anydpi-v26/${name}.xml`, ADAPTIVE_ICON);
  }
  for (const [density, size] of Object.entries(LEGACY_DENSITIES)) {
    for (const [name, plateShape] of [
      ['ic_launcher', 'rounded'],
      ['ic_launcher_round', 'circle'],
    ]) {
      write(
        `${ANDROID_RES}/mipmap-${density}/${name}.png`,
        await rasterise(
          iconSvg({ size, appearance: 'light', plateShape }),
          size,
        ),
      );
    }
  }
} finally {
  await browser.close();
}
