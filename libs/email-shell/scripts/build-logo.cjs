// @ts-check
/**
 * Rasterizes the email logo SVG source into the PNG the mail sender attaches
 * as a CID part (ADR 0034). Gmail, Outlook, and Yahoo do not render SVG, so a
 * raster asset is required; this script keeps it in sync with the SVG source
 * rather than depending on a one-off manual export.
 *
 * Run via:  nx run email-shell:build-logo
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const SVG_SOURCE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'apps',
  'myorganizer',
  'public',
  'images',
  'logo-email.svg',
);
const OUT_DIR = path.join(__dirname, '..', 'src', 'assets');
const OUT_FILE = path.join(OUT_DIR, 'logo-email.png');

// 3x the 140x32 display size the Email Shell template requests, so the logo
// stays crisp on retina displays.
const OUTPUT_WIDTH = 420;

async function run() {
  const svg = fs.readFileSync(SVG_SOURCE);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  await sharp(svg, { density: 384 })
    .resize({ width: OUTPUT_WIDTH })
    .png()
    .toFile(OUT_FILE);

  // eslint-disable-next-line no-console
  console.log(`email-shell: generated ${path.relative(process.cwd(), OUT_FILE)} from ${path.relative(process.cwd(), SVG_SOURCE)}.`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
