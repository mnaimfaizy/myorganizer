import { assertCidLinkage, collectCidReferences } from './cidLinkage';
import type { EmailAttachment } from './types';

describe('cidLinkage', () => {
  describe('collectCidReferences', () => {
    it('extracts CID from src="cid:..." attributes', () => {
      const html = '<img src="cid:logo-email" alt="Logo" />';
      const refs = collectCidReferences(html);
      expect(refs).toEqual(['logo-email']);
    });

    it('extracts CID from href="cid:..." attributes', () => {
      const html = '<a href="cid:attachment-1">Download</a>';
      const refs = collectCidReferences(html);
      expect(refs).toEqual(['attachment-1']);
    });

    it('extracts multiple CIDs in document order', () => {
      const html = `
        <img src="cid:logo" />
        <a href="cid:doc1">Doc 1</a>
        <img src="cid:banner" />
        <a href="cid:doc2">Doc 2</a>
      `;
      const refs = collectCidReferences(html);
      expect(refs).toEqual(['logo', 'doc1', 'banner', 'doc2']);
    });

    it('deduplicates repeated CID references', () => {
      const html = `
        <img src="cid:logo" />
        <img src="cid:logo" />
        <img src="cid:logo" />
      `;
      const refs = collectCidReferences(html);
      expect(refs).toEqual(['logo']);
    });

    it('ignores bare "cid:" in body text (does not match src/href)', () => {
      const html =
        'For details, contact support at cid:support@example.com or see cid: myorganizer-logo in the docs.';
      const refs = collectCidReferences(html);
      expect(refs).toEqual([]);
    });

    it('ignores cid: in malformed attributes (missing quotes or non-src/href)', () => {
      const html = `
        <img data-cid="cid:logo" />
        <div class="cid:warning">Warning</div>
        <img src=cid:unquoted />
      `;
      const refs = collectCidReferences(html);
      expect(refs).toEqual([]);
    });

    it('ignores http/https URLs even if they contain "cid"', () => {
      const html = '<img src="https://example.com/images/cidlogo.jpg?v=1" />';
      const refs = collectCidReferences(html);
      expect(refs).toEqual([]);
    });

    it('handles mixed http and cid references', () => {
      const html = `
        <img src="https://cdn.example.com/thumb.jpg" />
        <img src="cid:mylogo" />
        <img src="https://example.com/image.png" />
      `;
      const refs = collectCidReferences(html);
      expect(refs).toEqual(['mylogo']);
    });
  });

  describe('assertCidLinkage', () => {
    it('throws when body references a CID with no attachment behind it', () => {
      const html = '<img src="cid:missing-attachment" />';
      const attachments: EmailAttachment[] = [];

      expect(() => assertCidLinkage(html, attachments)).toThrow(
        'Email body references CIDs it carries no attachment for: missing-attachment.',
      );
    });

    it('throws when carrying an attachment no body references', () => {
      const html = '<img src="cid:logo" />';
      const attachments: EmailAttachment[] = [
        {
          filename: 'logo.png',
          content: Buffer.from('fake-png'),
          contentType: 'image/png',
          cid: 'logo',
          contentDisposition: 'inline',
        },
        {
          filename: 'unused.png',
          content: Buffer.from('fake-png'),
          contentType: 'image/png',
          cid: 'unused',
          contentDisposition: 'inline',
        },
      ];

      expect(() => assertCidLinkage(html, attachments)).toThrow(
        'Email carries attachments no body references: unused.',
      );
    });

    it('throws when multiple CIDs are unattached', () => {
      const html = '<img src="cid:missing1" /><img src="cid:missing2" />';
      const attachments: EmailAttachment[] = [];

      expect(() => assertCidLinkage(html, attachments)).toThrow(
        /missing1.*missing2|missing2.*missing1/,
      );
    });

    it('throws when multiple attachments are unreferenced', () => {
      const html = '<img src="cid:logo" />';
      const attachments: EmailAttachment[] = [
        {
          filename: 'logo.png',
          content: Buffer.from('fake-png'),
          contentType: 'image/png',
          cid: 'logo',
          contentDisposition: 'inline',
        },
        {
          filename: 'unused1.png',
          content: Buffer.from('fake-png'),
          contentType: 'image/png',
          cid: 'unused1',
          contentDisposition: 'inline',
        },
        {
          filename: 'unused2.png',
          content: Buffer.from('fake-png'),
          contentType: 'image/png',
          cid: 'unused2',
          contentDisposition: 'inline',
        },
      ];

      expect(() => assertCidLinkage(html, attachments)).toThrow(
        /unused1.*unused2|unused2.*unused1/,
      );
    });

    it('passes when all CIDs are attached and all attachments are referenced', () => {
      const html = '<img src="cid:logo" /><a href="cid:document">Doc</a>';
      const attachments: EmailAttachment[] = [
        {
          filename: 'logo.png',
          content: Buffer.from('fake-png'),
          contentType: 'image/png',
          cid: 'logo',
          contentDisposition: 'inline',
        },
        {
          filename: 'doc.pdf',
          content: Buffer.from('fake-pdf'),
          contentType: 'application/pdf',
          cid: 'document',
          contentDisposition: 'inline',
        },
      ];

      expect(() => assertCidLinkage(html, attachments)).not.toThrow();
    });

    it('passes with single logo attachment on a full shell render', () => {
      const html = `<!doctype html>
<html>
  <head>
    <title>Test</title>
  </head>
  <body>
    <img src="cid:myorganizer-logo" width="140" height="32" alt="MyOrganizer" />
    <p>Hello world</p>
  </body>
</html>`;
      const attachments: EmailAttachment[] = [
        {
          filename: 'logo-email.png',
          content: Buffer.from('fake-png-data'),
          contentType: 'image/png',
          cid: 'myorganizer-logo',
          contentDisposition: 'inline',
        },
      ];

      expect(() => assertCidLinkage(html, attachments)).not.toThrow();
    });

    it('passes when deduplicated CIDs match deduplicated attachments', () => {
      const html = `
        <img src="cid:logo" />
        <img src="cid:logo" />
        <img src="cid:logo" />
      `;
      const attachments: EmailAttachment[] = [
        {
          filename: 'logo.png',
          content: Buffer.from('fake-png'),
          contentType: 'image/png',
          cid: 'logo',
          contentDisposition: 'inline',
        },
      ];

      expect(() => assertCidLinkage(html, attachments)).not.toThrow();
    });

    it('does not throw on empty html and empty attachments', () => {
      expect(() => assertCidLinkage('', [])).not.toThrow();
    });
  });
});
