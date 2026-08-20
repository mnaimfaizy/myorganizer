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
} from '@myorganizer/design-tokens';
import { escapeHtml } from './escapeHtml';
import {
  EMAIL_LOGO_CID,
  EmailBodyBlock,
  RenderedEmail,
  RenderEmailShellOptions,
} from './types';

const BRAND_NAME = 'MyOrganizer';

/**
 * Renders a body inside the shared MyOrganizer Email Shell (ADR 0034).
 * `options.emailClass` is required and has no default: an email that does not
 * declare whether it is Transactional or Notification must not render at all,
 * because that declaration is the only thing deciding whether the footer
 * carries an unsubscribe link.
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

  return {
    html: renderHtml(options, year),
    text: renderText(options, year),
  };
}

function renderHtml(options: RenderEmailShellOptions, year: number): string {
  const preheaderHtml = renderPreheaderHtml(options.preheader);
  const bodyHtml = options.blocks.map(renderBlockHtml).join('');
  const footerHtml = renderFooterHtml(options, year);

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${BRAND_NAME}</title>
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
            <img src="cid:${EMAIL_LOGO_CID}" width="140" height="32" alt="${BRAND_NAME}" style="display: block; border: 0; outline: none; text-decoration: none;" />
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

function renderBlockHtml(block: EmailBodyBlock): string {
  switch (block.kind) {
    case 'heading':
      return `<tr><td style="padding: 0 0 ${spaceMd} 0; font-family: ${fontDisplay}; font-size: 22px; line-height: 28px; font-weight: 700; color: ${colorPrimary};">${escapeHtml(block.text)}</td></tr>`;
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
  }
}

function renderFooterHtml(
  options: RenderEmailShellOptions,
  year: number,
): string {
  const unsubscribe =
    options.emailClass === 'notification'
      ? ` &middot; <a href="${escapeHtml(options.unsubscribeUrl)}" style="color: ${colorMuted}; text-decoration: underline;">Unsubscribe</a>`
      : '';

  return `<tr><td style="padding: ${spaceLg} 0 0 0; border-top: 1px solid ${colorBorder}; font-family: ${fontBody}; font-size: 12px; line-height: 18px; color: ${colorMuted};">&copy; ${year} ${BRAND_NAME}${unsubscribe}</td></tr>`;
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
  }
}

function renderFooterText(
  options: RenderEmailShellOptions,
  year: number,
): string {
  const lines = [`© ${year} ${BRAND_NAME}`];
  if (options.emailClass === 'notification') {
    lines.push(`Unsubscribe: ${options.unsubscribeUrl}`);
  }
  return lines.join('\n');
}
