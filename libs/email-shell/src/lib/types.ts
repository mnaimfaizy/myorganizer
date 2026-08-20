/** A Transactional Email carries no unsubscribe link; a Notification Email always does (ADR 0034). */
export type EmailClass = 'transactional' | 'notification';

export type EmailBodyBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'button'; label: string; url: string }
  | { kind: 'list'; items: string[] };

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

export interface RenderedEmail {
  html: string;
  text: string;
}

/** Content-ID the shell's logo `<img>` references; the mail sender must attach a matching CID part (ADR 0034). */
export const EMAIL_LOGO_CID = 'myorganizer-logo';
