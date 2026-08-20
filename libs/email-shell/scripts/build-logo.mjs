// @ts-check
/**
 * Rasterizes the email logo SVG source into the PNG the mail sender attaches as
 * a CID part (ADR 0034). Gmail, Outlook, and Yahoo do not render SVG, so a
 * raster asset is required, and slice #396 requires regenerating it to be
 * repeatable rather than a one-off manual export.
 *
 * The rasterizer is Playwright's headless Chromium rather than a native image
 * library. Playwright is already a devDependency for E2E, so this adds nothing
 * to the install; a native rasterizer (sharp) has to compile or fetch a
 * platform binary in every sandbox install, which is what broke the #396
 * dispatch at `yarn install --immutable`. Chromium also renders the SVG with
 * the same engine a browser would, so what ships is what the source looks like.
 *
 * Run via:  yarn nx run email-shell:build-logo
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const SVG_SOURCE = join(
  repoRoot,
  'apps',
  'myorganizer',
  'public',
  'images',
  'logo-email.svg',
);
const OUT_DIR = join(here, '..', 'src', 'assets');
const OUT_FILE = join(OUT_DIR, 'logo-email.png');
const GENERATED_DIR = join(here, '..', 'src', 'generated');
const GENERATED_FILE = join(GENERATED_DIR, 'logoEmailPng.ts');

// 3x the 140px display width the Email Shell template requests, so the logo
// stays crisp on retina displays.
const OUTPUT_WIDTH = 420;

/**
 * Height comes from the source's own aspect ratio — hardcoding it would let the
 * PNG silently distort the next time the SVG's viewBox changes.
 *
 * @param {string} svg
 * @returns {number}
 */
function heightForWidth(svg) {
  const viewBox = /viewBox="([\d.\s-]+)"/.exec(svg);
  if (!viewBox) {
    throw new Error(`No viewBox found in ${SVG_SOURCE}; cannot derive height.`);
  }

  const [, , width, height] = viewBox[1].trim().split(/\s+/).map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0) {
    throw new Error(`Unusable viewBox "${viewBox[1]}" in ${SVG_SOURCE}.`);
  }

  return Math.round((OUTPUT_WIDTH * height) / width);
}

/**
 * Emits the PNG a second time as a base64 TypeScript literal.
 *
 * The shell attaches the logo from this module rather than reading the `.png`
 * off disk, because the file sits at one path in the TypeScript sources and
 * another inside the webpack bundle the backend ships. Resolving that
 * difference at runtime is the dist-versus-dev candidate-path lookup ADR 0034
 * set out to remove, so the bytes are compiled in instead.
 *
 * @param {Buffer} png
 */
function writeBase64Module(png) {
  const base64 = png.toString('base64');
  const lines = (base64.match(/.{1,96}/g) ?? []).map((chunk) => `  '${chunk}'`);

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(
    GENERATED_FILE,
    [
      '/**',
      ' * GENERATED FILE — do not edit.',
      ' *',
      ' * Produced by `yarn nx run email-shell:build-logo` from',
      ' * `libs/email-shell/src/assets/logo-email.png`.',
      ' *',
      ' * The logo ships as a base64 literal rather than a file the shell reads at',
      ' * runtime. A mail body must be renderable from a pure function with no disk',
      ' * access, and the alternative — resolving an asset path that differs between',
      ' * the TypeScript sources and the webpack bundle — is the exact dist-versus-dev',
      ' * lookup that used to guard the auth templates (ADR 0034).',
      ' */',
      'export const LOGO_EMAIL_PNG_BASE64 =',
      `${lines.join(' +\n')};`,
      '',
    ].join('\n'),
  );
}

async function run() {
  const svg = readFileSync(SVG_SOURCE, 'utf8');
  const outputHeight = heightForWidth(svg);

  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: OUTPUT_WIDTH, height: outputHeight },
      deviceScaleFactor: 1,
    });

    // The SVG is inlined rather than loaded over file:// so nothing depends on
    // the working directory, and sized by CSS so the vector scales up cleanly.
    await page.setContent(
      `<!doctype html><meta charset="utf-8">` +
        `<style>` +
        `html,body{margin:0;padding:0;background:transparent}` +
        `svg{display:block;width:${OUTPUT_WIDTH}px;height:${outputHeight}px}` +
        `</style>` +
        svg,
      { waitUntil: 'load' },
    );

    // omitBackground keeps the alpha channel, so the logo sits on whatever
    // background a mail client forces on it (ADR 0034: colours survive
    // inversion rather than fighting it).
    await page.screenshot({ path: OUT_FILE, omitBackground: true });
  } finally {
    await browser.close();
  }

  writeBase64Module(readFileSync(OUT_FILE));

  console.log(
    `email-shell: generated ${relative(repoRoot, OUT_FILE)} ` +
      `(${OUTPUT_WIDTH}x${outputHeight}) and ` +
      `${relative(repoRoot, GENERATED_FILE)} ` +
      `from ${relative(repoRoot, SVG_SOURCE)}.`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
