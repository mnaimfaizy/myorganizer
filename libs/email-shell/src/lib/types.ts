/** A Transactional Email carries no unsubscribe link; a Notification Email always does (ADR 0034). */
export type EmailClass = 'transactional' | 'notification';

/**
 * One row of a fluid media list — a thumbnail, a title, and a supporting line.
 *
 * Deliberately has no width: the Weekly Digest used to emit its thumbnails at a
 * fixed 168px inside a table whose cell had no width constraint, which is the
 * classic horizontal-scroll email on a narrow phone (ADR 0034). The shell sizes
 * these rows in percentages so a caller cannot reintroduce that.
 */
export interface EmailMediaItem {
  title: string;
  /** Secondary line under the title — source, date, or both. */
  meta: string;
  url: string;
  /** Absolute image URL. Omitted or null renders the row text-only. */
  imageUrl?: string | null;
  /** Alt text for the thumbnail. Empty renders it decorative. */
  imageAlt?: string;
}

export type EmailBodyBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'button'; label: string; url: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'mediaList'; items: EmailMediaItem[] }
  | {
      kind: 'footnote';
      text: string;
      links?: { label: string; url: string }[];
    };

interface RenderEmailShellBaseOptions {
  /** Shown by mail clients in the inbox list before the body is opened. */
  preheader: string;
  blocks: EmailBodyBlock[];
}

export type RenderEmailShellOptions =
  | (RenderEmailShellBaseOptions & { emailClass: 'transactional' })
  | (RenderEmailShellBaseOptions & {
      emailClass: 'notification';
      unsubscribeUrl: string;
    });

/**
 * An inline attachment the rendered body references by Content-ID.
 *
 * Structurally assignable to nodemailer's `Attachment`, so the mail sender can
 * forward these untouched without the shell depending on nodemailer.
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** Matches a `cid:<id>` reference in {@link RenderedEmail.html}. */
  cid: string;
  contentDisposition: 'inline';
}

export interface RenderedEmail {
  html: string;
  text: string;
  /**
   * Every entry is referenced by `html`. The shell enforces this on each
   * render; see `assertCidLinkage`.
   */
  attachments: EmailAttachment[];
}

/** Content-ID the shell's logo `<img>` references and its attachment carries (ADR 0034). */
export const EMAIL_LOGO_CID = 'myorganizer-logo';
