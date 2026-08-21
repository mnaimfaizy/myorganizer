import { EmailAttachment } from './types';

/**
 * Matches the `cid:` targets a rendered body actually points at. Restricted to
 * `src="cid:…"` / `href="cid:…"` so the word appearing in body copy cannot be
 * mistaken for a reference.
 */
const CID_REFERENCE = /(?:src|href)="cid:([^"]+)"/g;

/** The Content-IDs an HTML body references, in document order, de-duplicated. */
export function collectCidReferences(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(CID_REFERENCE)) {
    found.add(match[1]);
  }
  return [...found];
}

/**
 * Asserts the CID linkage invariant: a message's attachments and the body it
 * ships with describe the same set of Content-IDs.
 *
 * This is the invariant PRD #393 exists to protect. An attachment nothing
 * references renders as exactly the broken image this work set out to fix, and
 * a `cid:` reference with no attachment behind it renders as the same thing
 * from the other direction. The mail sender cannot own this — it is a
 * pass-through that never sees how a body was built — so the shell, which
 * composes body and attachments together, enforces it on every render.
 */
export function assertCidLinkage(
  html: string,
  attachments: readonly EmailAttachment[],
): void {
  const referenced = new Set(collectCidReferences(html));
  const attached = new Set(attachments.map((attachment) => attachment.cid));

  const unreferenced = [...attached].filter((cid) => !referenced.has(cid));
  if (unreferenced.length > 0) {
    throw new Error(
      `Email carries attachments no body references: ${unreferenced.join(', ')}.`,
    );
  }

  const unattached = [...referenced].filter((cid) => !attached.has(cid));
  if (unattached.length > 0) {
    throw new Error(
      `Email body references CIDs it carries no attachment for: ${unattached.join(', ')}.`,
    );
  }
}
