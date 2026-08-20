import {
  colorBorder,
  colorCard,
  colorMuted,
  colorOnPrimary,
  colorPrimary,
  colorSurface,
  fontBody,
  fontDisplay,
  radiusLg,
  radiusMd,
  spaceLg,
  spaceMarginMobile,
  spaceMd,
  spaceSm,
  spaceXs,
} from '@myorganizer/design-tokens';
import { LOGO_EMAIL_PNG_BASE64 } from '../generated/logoEmailPng';
import { assertCidLinkage } from './cidLinkage';
import { escapeHtml } from './escapeHtml';
import {
  EMAIL_LOGO_CID,
  EmailAttachment,
  EmailBodyBlock,
  EmailMediaItem,
  RenderedEmail,
  RenderEmailShellOptions,
} from './types';

/** The name every MyOrganizer email signs itself with; the shell owns it, not a caller or an env var. */
export const EMAIL_BRAND_NAME = 'MyOrganizer';

/**
 * Caps thumbnail upscaling without capping the row.
 *
 * The row itself is fluid — the image is `width: 100%` of its cell — so on a
 * narrow phone it shrinks rather than forcing the body wider. This only stops a
 * small source image being stretched across a 600px desktop frame.
 */
const MEDIA_THUMBNAIL_MAX_WIDTH = '320px';

/**
 * Renders a body inside the shared MyOrganizer Email Shell (ADR 0034).
 * `options.emailClass` is required and has no default: an email that does not
 * declare whether it is Transactional or Notification must not render at all,
 * because that declaration is the only thing deciding whether the footer
 * carries an unsubscribe link.
 *
 * Returns the attachments alongside the body rather than leaving the caller to
 * pair them up. The shell is the only place that knows which Content-IDs the
 * body it just built refers to, so it is the only place that can guarantee
 * every attachment shipped is one the body points at.
 */
export function renderEmailShell(
  options: RenderEmailShellOptions,
): RenderedEmail {
  if (
    options == null ||
    (options.emailClass !== 'transactional' &&
      options.emailClass !== 'notification')
  ) {
    throw new Error(
      'renderEmailShell requires options.emailClass to be "transactional" or "notification"; there is no default.',
    );
  }
  if (options.emailClass === 'notification' && !options.unsubscribeUrl) {
    throw new Error('A Notification Email must supply unsubscribeUrl.');
  }
  if (!options.preheader) {
    throw new Error('renderEmailShell requires a preheader.');
  }

  const year = new Date().getFullYear();

  const html = renderHtml(options, year);
  const attachments = [logoAttachment()];

  assertCidLinkage(html, attachments);

  return {
    html,
    text: renderText(options, year),
    attachments,
  };
}

function logoAttachment(): EmailAttachment {
  return {
    filename: 'logo-email.png',
    content: Buffer.from(LOGO_EMAIL_PNG_BASE64, 'base64'),
    contentType: 'image/png',
    cid: EMAIL_LOGO_CID,
    contentDisposition: 'inline',
  };
}

function renderHtml(options: RenderEmailShellOptions, year: number): string {
  const preheaderHtml = renderPreheaderHtml(options.preheader);
  const bodyHtml = renderBlocksHtml(options.blocks);
  const footerHtml = renderFooterHtml(options, year);

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${EMAIL_BRAND_NAME}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${colorSurface};">
    ${preheaderHtml}
    <center style="width: 100%; background-color: ${colorSurface};">
      <!--[if mso]>
      <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: ${colorCard}; border: 1px solid ${colorBorder}; border-radius: ${radiusLg};">
        <tr>
          <td style="padding: ${spaceLg} ${spaceLg} 0 ${spaceLg};">
            <img src="cid:${EMAIL_LOGO_CID}" width="140" height="32" alt="${EMAIL_BRAND_NAME}" style="display: block; border: 0; outline: none; text-decoration: none;" />
          </td>
        </tr>
        <tr>
          <td style="padding: ${spaceLg} ${spaceLg} ${spaceMarginMobile} ${spaceLg};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              ${bodyHtml}
              ${footerHtml}
            </table>
          </td>
        </tr>
      </table>
      <!--[if mso]>
      </td></tr></table>
      <![endif]-->
    </center>
  </body>
</html>`;
}

function renderPreheaderHtml(preheader: string): string {
  // Repeated &zwnj;&nbsp; pushes the client's auto-scraped preview past the
  // hidden text so it never falls back to scraping the visible body instead.
  const padding = '&nbsp;&zwnj;'.repeat(40);
  return `<div style="display: none; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all;">${escapeHtml(preheader)}${padding}</div>`;
}

/**
 * Renders the body blocks, numbering headings as it goes.
 *
 * ADR 0034 asks for semantic headings, which means one `<h1>` per message and
 * `<h2>` for anything under it. A block cannot know its own level, so the
 * decision is made here rather than inside {@link renderBlockHtml}: the first
 * heading a body declares is its title, the rest are sections.
 */
function renderBlocksHtml(blocks: EmailBodyBlock[]): string {
  let headingsSoFar = 0;
  return blocks
    .map((block) => {
      if (block.kind === 'heading') headingsSoFar += 1;
      return renderBlockHtml(block, headingsSoFar <= 1 ? 'h1' : 'h2');
    })
    .join('');
}

function renderBlockHtml(
  block: EmailBodyBlock,
  headingTag: 'h1' | 'h2',
): string {
  switch (block.kind) {
    case 'heading':
      // `margin: 0` because clients apply their own heading margins, and the
      // row's padding is what the shell's spacing scale actually controls.
      return `<tr><td style="padding: 0 0 ${spaceMd} 0;"><${headingTag} style="margin: 0; font-family: ${fontDisplay}; font-size: 22px; line-height: 28px; font-weight: 700; color: ${colorPrimary};">${escapeHtml(block.text)}</${headingTag}></td></tr>`;
    case 'paragraph':
      return `<tr><td style="padding: 0 0 ${spaceMd} 0; font-family: ${fontBody}; font-size: 15px; line-height: 22px; color: ${colorPrimary};">${escapeHtml(block.text)}</td></tr>`;
    case 'button':
      return `<tr><td style="padding: ${spaceSm} 0 ${spaceLg} 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius: ${radiusMd}; background-color: ${colorPrimary};">
                    <a href="${escapeHtml(block.url)}" style="display: inline-block; padding: 12px 24px; font-family: ${fontBody}; font-size: 15px; font-weight: 600; line-height: 20px; color: ${colorOnPrimary}; text-decoration: none; border-radius: ${radiusMd};">${escapeHtml(block.label)}</a>
                  </td>
                </tr>
              </table>
            </td></tr>`;
    case 'list':
      return `<tr><td style="padding: 0 0 ${spaceMd} 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                ${block.items
                  .map(
                    (item) =>
                      `<tr><td style="padding: 4px 0; font-family: ${fontBody}; font-size: 15px; line-height: 22px; color: ${colorPrimary};">&bull;&nbsp;${escapeHtml(item)}</td></tr>`,
                  )
                  .join('')}
              </table>
            </td></tr>`;
    case 'mediaList':
      return `<tr><td style="padding: 0 0 ${spaceMd} 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                ${block.items.map(renderMediaItemHtml).join('')}
              </table>
            </td></tr>`;
    case 'footnote':
      return renderFootnoteHtml(block.text, block.links ?? []);
  }
}

/**
 * One fluid media row.
 *
 * Every width here is a percentage and the cell declares `width: 100%`, so the
 * row can never be wider than the 600px frame the shell caps itself at. The
 * thumbnail carries `width="100%"` as an HTML attribute as well as inline CSS
 * because Outlook's Word engine reads the attribute and ignores `max-width`;
 * `height: auto` with no `height` attribute keeps the aspect ratio wherever the
 * width lands.
 */
function renderMediaItemHtml(item: EmailMediaItem): string {
  const thumbnail = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt ?? '')}" width="100%" style="display: block; width: 100%; max-width: ${MEDIA_THUMBNAIL_MAX_WIDTH}; height: auto; border: 0; outline: none; text-decoration: none; border-radius: ${radiusMd}; margin: 0 0 ${spaceSm} 0;" />`
    : '';

  return `<tr>
                  <td style="width: 100%; padding: ${spaceMd} 0; border-bottom: 1px solid ${colorBorder};">
                    <a href="${escapeHtml(item.url)}" style="display: block; text-decoration: none; color: ${colorPrimary};">
                      ${thumbnail}<span style="font-family: ${fontBody}; font-size: 15px; line-height: 22px; font-weight: 600; color: ${colorPrimary};">${escapeHtml(item.title)}</span>
                    </a>
                    <div style="padding: ${spaceXs} 0 0 0; font-family: ${fontBody}; font-size: 13px; line-height: 18px; color: ${colorMuted};">${escapeHtml(item.meta)}</div>
                  </td>
                </tr>`;
}

function renderFootnoteHtml(
  text: string,
  links: { label: string; url: string }[],
): string {
  const linkHtml = links
    .map(
      (link) =>
        `<a href="${escapeHtml(link.url)}" style="color: ${colorMuted}; text-decoration: underline;">${escapeHtml(link.label)}</a>`,
    )
    .join(' &middot; ');
  const linkLine = linkHtml ? `<br />${linkHtml}` : '';

  return `<tr><td style="padding: ${spaceMd} 0 0 0; font-family: ${fontBody}; font-size: 13px; line-height: 18px; color: ${colorMuted};">${escapeHtml(text)}${linkLine}</td></tr>`;
}

function renderFooterHtml(
  options: RenderEmailShellOptions,
  year: number,
): string {
  const unsubscribe =
    options.emailClass === 'notification'
      ? ` &middot; <a href="${escapeHtml(options.unsubscribeUrl)}" style="color: ${colorMuted}; text-decoration: underline;">Unsubscribe</a>`
      : '';

  return `<tr><td style="padding: ${spaceLg} 0 0 0; border-top: 1px solid ${colorBorder}; font-family: ${fontBody}; font-size: 12px; line-height: 18px; color: ${colorMuted};">&copy; ${year} ${EMAIL_BRAND_NAME}${unsubscribe}</td></tr>`;
}

function renderText(options: RenderEmailShellOptions, year: number): string {
  const parts = options.blocks
    .map(renderBlockText)
    .filter((part) => part.length > 0);
  parts.push(renderFooterText(options, year));
  return parts.join('\n\n');
}

function renderBlockText(block: EmailBodyBlock): string {
  switch (block.kind) {
    case 'heading':
      return block.text;
    case 'paragraph':
      return block.text;
    case 'button':
      return `${block.label}: ${block.url}`;
    case 'list':
      return block.items.map((item) => `- ${item}`).join('\n');
    case 'mediaList':
      return block.items
        .map((item) => `- ${item.title} (${item.meta}): ${item.url}`)
        .join('\n');
    case 'footnote':
      return [
        block.text,
        ...(block.links ?? []).map((link) => `${link.label}: ${link.url}`),
      ].join('\n');
  }
}

function renderFooterText(
  options: RenderEmailShellOptions,
  year: number,
): string {
  const lines = [`© ${year} ${EMAIL_BRAND_NAME}`];
  if (options.emailClass === 'notification') {
    lines.push(`Unsubscribe: ${options.unsubscribeUrl}`);
  }
  return lines.join('\n');
}
