import {
  colorBorder,
  colorCard,
  colorMuted,
  colorOnPrimary,
  colorPrimary,
  colorSurface,
} from '@myorganizer/design-tokens';
import { collectCidReferences } from './cidLinkage';
import { EMAIL_LOGO_CID, EMAIL_BRAND_NAME } from './renderEmailShell';
import { renderEmailShell } from './renderEmailShell';
import type { EmailBodyBlock } from './types';

describe('renderEmailShell', () => {
  describe('validation: emailClass', () => {
    it('throws when options is null', () => {
      expect(() => {
        renderEmailShell(null as any);
      }).toThrow(
        'renderEmailShell requires options.emailClass to be "transactional" or "notification"',
      );
    });

    it('throws when options is undefined', () => {
      expect(() => {
        renderEmailShell(undefined as any);
      }).toThrow(
        'renderEmailShell requires options.emailClass to be "transactional" or "notification"',
      );
    });

    it('throws when emailClass is omitted', () => {
      expect(() => {
        renderEmailShell({
          preheader: 'Test',
          blocks: [],
        } as any);
      }).toThrow(
        'renderEmailShell requires options.emailClass to be "transactional" or "notification"',
      );
    });

    it('throws when emailClass is an invalid string', () => {
      expect(() => {
        renderEmailShell({
          emailClass: 'promotional' as any,
          preheader: 'Test',
          blocks: [],
        });
      }).toThrow(
        'renderEmailShell requires options.emailClass to be "transactional" or "notification"',
      );
    });

    it('throws when emailClass is an empty string', () => {
      expect(() => {
        renderEmailShell({
          emailClass: '' as any,
          preheader: 'Test',
          blocks: [],
        });
      }).toThrow(
        'renderEmailShell requires options.emailClass to be "transactional" or "notification"',
      );
    });
  });

  describe('validation: notification unsubscribeUrl', () => {
    it('throws when emailClass is notification and unsubscribeUrl is missing', () => {
      expect(() => {
        renderEmailShell({
          emailClass: 'notification',
          preheader: 'Test',
          blocks: [],
        } as any);
      }).toThrow('A Notification Email must supply unsubscribeUrl.');
    });

    it('throws when emailClass is notification and unsubscribeUrl is an empty string', () => {
      expect(() => {
        renderEmailShell({
          emailClass: 'notification',
          preheader: 'Test',
          blocks: [],
          unsubscribeUrl: '',
        });
      }).toThrow('A Notification Email must supply unsubscribeUrl.');
    });
  });

  describe('validation: preheader', () => {
    it('throws when preheader is missing', () => {
      expect(() => {
        renderEmailShell({
          emailClass: 'transactional',
          blocks: [],
        } as any);
      }).toThrow('renderEmailShell requires a preheader.');
    });

    it('throws when preheader is an empty string', () => {
      expect(() => {
        renderEmailShell({
          emailClass: 'transactional',
          preheader: '',
          blocks: [],
        });
      }).toThrow('renderEmailShell requires a preheader.');
    });
  });

  describe('transactional email rendering', () => {
    it('returns { html, text } with valid transactional input', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Reset your password',
        blocks: [
          { kind: 'heading', text: 'Reset Password' },
          {
            kind: 'paragraph',
            text: 'Click the button below to reset your password.',
          },
        ],
      });

      expect(typeof result.html).toBe('string');
      expect(typeof result.text).toBe('string');
      expect(result.html).toBeTruthy();
      expect(result.text).toBeTruthy();
    });

    it('starts html with <!doctype html>', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toMatch(/^<!doctype html>/i);
    });

    it('does not include unsubscribe link in html for transactional email', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).not.toContain('Unsubscribe');
    });

    it('does not include unsubscribe line in text for transactional email', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.text).not.toContain('Unsubscribe:');
    });

    it('does not include unsubscribe even if a button contains the word unsubscribe in its URL', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'button',
            label: 'Click me',
            url: 'https://example.com/unsubscribe',
          },
        ],
      });

      // Count occurrences of "Unsubscribe" as the footer link/line (case-sensitive)
      const unsubscribeMatches = result.html.match(/Unsubscribe/g);
      expect(unsubscribeMatches).toBeNull();
      expect(result.text).not.toContain('Unsubscribe:');
    });
  });

  describe('notification email rendering', () => {
    it('includes unsubscribe link in html for notification email', () => {
      const unsubscribeUrl = 'https://app.example.com/u/abc';
      const result = renderEmailShell({
        emailClass: 'notification',
        preheader: 'Your update',
        blocks: [],
        unsubscribeUrl,
      });

      expect(result.html).toContain('Unsubscribe');
      expect(result.html).toContain(`href="${unsubscribeUrl}"`);
    });

    it('includes unsubscribe line in text for notification email', () => {
      const unsubscribeUrl = 'https://app.example.com/u/abc';
      const result = renderEmailShell({
        emailClass: 'notification',
        preheader: 'Your update',
        blocks: [],
        unsubscribeUrl,
      });

      expect(result.text).toContain(`Unsubscribe: ${unsubscribeUrl}`);
    });

    it('escapes unsubscribeUrl in the html href attribute', () => {
      const result = renderEmailShell({
        emailClass: 'notification',
        preheader: 'Test',
        blocks: [],
        unsubscribeUrl:
          'https://example.com/?param=value&other=1"onmouseover="alert(1)',
      });

      // The URL should be HTML-escaped in the href attribute
      expect(result.html).toContain(
        'href="https://example.com/?param=value&amp;other=1&quot;onmouseover=&quot;alert(1)"',
      );
      // But the raw URL should NOT appear unescaped
      expect(result.html).not.toContain('onmouseover="alert(1)');
    });
  });

  describe('block rendering: heading', () => {
    it('renders heading text in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'heading', text: 'Reset Password' }],
      });

      expect(result.html).toContain('Reset Password');
    });

    it('renders heading text in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'heading', text: 'Reset Password' }],
      });

      expect(result.text).toContain('Reset Password');
    });

    it('escapes heading text in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'heading', text: '<script>alert(1)</script>' }],
      });

      expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(result.html).not.toContain('<script>');
    });

    it('does not escape heading text in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'heading', text: 'Tom & Jerry' }],
      });

      expect(result.text).toContain('Tom & Jerry');
    });
  });

  describe('block rendering: paragraph', () => {
    it('renders paragraph text in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'paragraph', text: 'Please click the button below.' }],
      });

      expect(result.html).toContain('Please click the button below.');
    });

    it('renders paragraph text in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'paragraph', text: 'Please click the button below.' }],
      });

      expect(result.text).toContain('Please click the button below.');
    });

    it('escapes paragraph text with special characters in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'paragraph', text: 'Click "here" & go' }],
      });

      expect(result.html).toContain('Click &quot;here&quot; &amp; go');
      expect(result.html).not.toContain('Click "here" & go');
    });
  });

  describe('block rendering: button', () => {
    it('renders button label and url in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'button',
            label: 'Reset Password',
            url: 'https://example.com/reset',
          },
        ],
      });

      expect(result.html).toContain('Reset Password');
      expect(result.html).toContain('href="https://example.com/reset"');
    });

    it('renders button as "label: url" in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'button',
            label: 'Click me',
            url: 'https://example.com/action',
          },
        ],
      });

      expect(result.text).toContain('Click me: https://example.com/action');
    });

    it('escapes button label in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          { kind: 'button', label: 'Click "now"', url: 'https://example.com' },
        ],
      });

      expect(result.html).toContain('Click &quot;now&quot;');
      expect(result.html).not.toContain('Click "now"');
    });

    it('escapes button url in html href attribute', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'button',
            label: 'Go',
            url: 'https://x.com/?a=1&b=2"onmouseover="alert(1)',
          },
        ],
      });

      expect(result.html).toContain(
        'href="https://x.com/?a=1&amp;b=2&quot;onmouseover=&quot;alert(1)"',
      );
      expect(result.html).not.toContain('onmouseover="alert(1)');
    });

    it('does not escape button url in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          { kind: 'button', label: 'Go', url: 'https://example.com/?a=1&b=2' },
        ],
      });

      expect(result.text).toContain('Go: https://example.com/?a=1&b=2');
    });
  });

  describe('block rendering: list', () => {
    it('renders list items in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'list',
            items: ['First item', 'Second item', 'Third item'],
          },
        ],
      });

      expect(result.html).toContain('First item');
      expect(result.html).toContain('Second item');
      expect(result.html).toContain('Third item');
    });

    it('renders list items as dashed lines in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'list',
            items: ['First', 'Second'],
          },
        ],
      });

      expect(result.text).toContain('- First');
      expect(result.text).toContain('- Second');
    });

    it('escapes list items in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'list',
            items: ['<b>bold</b>', 'Tom & Jerry'],
          },
        ],
      });

      expect(result.html).toContain('&lt;b&gt;bold&lt;/b&gt;');
      expect(result.html).toContain('Tom &amp; Jerry');
      expect(result.html).not.toContain('<b>bold</b>');
    });

    it('does not escape list items in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'list',
            items: ['Tom & Jerry', 'Cook & Serve'],
          },
        ],
      });

      expect(result.text).toContain('- Tom & Jerry');
      expect(result.text).toContain('- Cook & Serve');
    });
  });

  describe('preheader handling', () => {
    it('includes escaped preheader in hidden div in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Reset your password',
        blocks: [],
      });

      expect(result.html).toContain('Reset your password');
      expect(result.html).toContain('display: none');
    });

    it('escapes preheader text in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Click <here> & "go"',
        blocks: [],
      });

      expect(result.html).toContain('Click &lt;here&gt; &amp; &quot;go&quot;');
      expect(result.html).not.toContain('Click <here>');
    });

    it('includes preheader padding with nbsp and zwnj in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      // Preheader should have repeated &zwnj;&nbsp; padding
      expect(result.html).toContain('&nbsp;&zwnj;');
      // Count occurrences - should be 40 repetitions
      const matches = result.html.match(/&nbsp;&zwnj;/g);
      expect(matches?.length).toBe(40);
    });

    it('does not include preheader in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Reset your password',
        blocks: [{ kind: 'paragraph', text: 'Some other text' }],
      });

      // The preheader text should not appear in the text version
      expect(result.text).not.toContain('Reset your password');
      expect(result.text).toContain('Some other text');
    });
  });

  describe('design token usage', () => {
    it('includes colorPrimary token value in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'heading', text: 'Test Heading' }],
      });

      expect(result.html).toContain(colorPrimary);
    });

    it('includes colorCard token value in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain(colorCard);
    });

    it('includes colorBorder token value in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain(colorBorder);
    });

    it('includes colorSurface token value in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain(colorSurface);
    });

    it('includes colorMuted token value in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain(colorMuted);
    });

    it('includes colorOnPrimary token value in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          { kind: 'button', label: 'Click', url: 'https://example.com' },
        ],
      });

      expect(result.html).toContain(colorOnPrimary);
    });

    it('does not include hard-coded non-token hex values like #007bff', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).not.toContain('#007bff');
    });
  });

  describe('copyright year', () => {
    it('includes current year in html footer', () => {
      const currentYear = new Date().getFullYear().toString();
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain(currentYear);
    });

    it('includes current year in text footer', () => {
      const currentYear = new Date().getFullYear().toString();
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.text).toContain(currentYear);
    });

    it('includes current year in notification email footer', () => {
      const currentYear = new Date().getFullYear().toString();
      const result = renderEmailShell({
        emailClass: 'notification',
        preheader: 'Test',
        blocks: [],
        unsubscribeUrl: 'https://example.com/unsub',
      });

      expect(result.html).toContain(currentYear);
      expect(result.text).toContain(currentYear);
    });
  });

  describe('edge cases', () => {
    it('renders with empty blocks array', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toMatch(/^<!doctype html>/i);
      expect(result.html).toBeTruthy();
      expect(result.text).toBeTruthy();
    });

    it('renders with multiple blocks of different kinds', () => {
      const blocks: EmailBodyBlock[] = [
        { kind: 'heading', text: 'Welcome' },
        { kind: 'paragraph', text: 'Here is your info:' },
        { kind: 'list', items: ['Item 1', 'Item 2'] },
        {
          kind: 'button',
          label: 'Confirm',
          url: 'https://example.com/confirm',
        },
        { kind: 'paragraph', text: 'Thank you' },
      ];

      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Multi-block test',
        blocks,
      });

      expect(result.html).toContain('Welcome');
      expect(result.html).toContain('Here is your info:');
      expect(result.html).toContain('Item 1');
      expect(result.html).toContain('Item 2');
      expect(result.html).toContain('Confirm');
      expect(result.html).toContain('https://example.com/confirm');
      expect(result.html).toContain('Thank you');

      expect(result.text).toContain('Welcome');
      expect(result.text).toContain('Here is your info:');
      expect(result.text).toContain('- Item 1');
      expect(result.text).toContain('- Item 2');
      expect(result.text).toContain('Confirm: https://example.com/confirm');
      expect(result.text).toContain('Thank you');
    });

    it('handles text version joining blocks with double newlines', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          { kind: 'paragraph', text: 'First paragraph' },
          { kind: 'paragraph', text: 'Second paragraph' },
        ],
      });

      // Blocks should be separated by double newlines in text version
      expect(result.text).toContain('First paragraph\n\nSecond paragraph');
    });

    it('handles all 5 escape characters correctly', () => {
      const testText = '& < > " \'';
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [{ kind: 'paragraph', text: testText }],
      });

      expect(result.html).toContain('&amp;');
      expect(result.html).toContain('&lt;');
      expect(result.html).toContain('&gt;');
      expect(result.html).toContain('&quot;');
      expect(result.html).toContain('&#39;');
    });
  });

  describe('CID reference', () => {
    it('includes logo with CID reference in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain('cid:myorganizer-logo');
      expect(result.html).toContain('<img');
    });

    it('does not include CID reference in text version', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.text).not.toContain('cid:');
      expect(result.text).not.toContain('img');
    });
  });

  describe('attachments', () => {
    it('returns exactly one attachment for transactional email', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.attachments).toHaveLength(1);
    });

    it('returns exactly one attachment for notification email', () => {
      const result = renderEmailShell({
        emailClass: 'notification',
        preheader: 'Test',
        blocks: [],
        unsubscribeUrl: 'https://example.com/unsub',
      });

      expect(result.attachments).toHaveLength(1);
    });

    it('logo attachment has correct filename and contentType', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.attachments[0].filename).toBe('logo-email.png');
      expect(result.attachments[0].contentType).toBe('image/png');
    });

    it('logo attachment has correct cid', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.attachments[0].cid).toBe(EMAIL_LOGO_CID);
    });

    it('logo attachment has contentDisposition inline', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.attachments[0].contentDisposition).toBe('inline');
    });

    it('logo attachment content is a non-empty Buffer with PNG magic number', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      const content = result.attachments[0].content;
      expect(Buffer.isBuffer(content)).toBe(true);
      expect(content.length).toBeGreaterThan(0);
      // PNG magic number: 0x89 'P' 'N' 'G'
      expect(content[0]).toBe(0x89);
      expect(content[1]).toBe(0x50); // 'P'
      expect(content[2]).toBe(0x4e); // 'N'
      expect(content[3]).toBe(0x47); // 'G'
    });
  });

  describe('CID linkage validation', () => {
    it('shell builds html that references all attachments', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      const referenced = collectCidReferences(result.html);
      const attached = result.attachments.map((a) => a.cid);

      expect(referenced).toEqual(attached);
    });

    it('CID linkage holds for notification email with complex body', () => {
      const result = renderEmailShell({
        emailClass: 'notification',
        preheader: 'Weekly digest',
        blocks: [
          { kind: 'heading', text: 'Your digest' },
          { kind: 'paragraph', text: 'Here is what is new.' },
          { kind: 'button', label: 'View', url: 'https://example.com' },
        ],
        unsubscribeUrl: 'https://example.com/unsub',
      });

      const referenced = collectCidReferences(result.html);
      const attached = result.attachments.map((a) => a.cid);

      expect(referenced).toEqual(attached);
    });
  });

  describe('mediaList block rendering', () => {
    it('renders mediaList item title, meta, and url', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Breaking News',
                meta: 'NewsChannel · Jan 15',
                url: 'https://news.example.com/story-1',
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('Breaking News');
      expect(result.html).toContain('NewsChannel · Jan 15');
      expect(result.html).toContain('https://news.example.com/story-1');
    });

    it('escapes title, meta, and url in mediaList', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: '<script>alert(1)</script>',
                meta: 'Channel & Date',
                url: 'https://example.com?a=1&b=2"onload="alert(1)',
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(result.html).toContain('Channel &amp; Date');
      expect(result.html).toContain('&amp;b=2&quot;onload=&quot;alert(1)');
      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('onload="alert(1)');
    });

    it('renders thumbnail img with imageUrl', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Video Title',
                meta: 'Channel',
                url: 'https://example.com',
                imageUrl: 'https://cdn.example.com/thumb.jpg',
                imageAlt: 'Video thumbnail',
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('<img');
      expect(result.html).toContain('src="https://cdn.example.com/thumb.jpg"');
      expect(result.html).toContain('alt="Video thumbnail"');
    });

    it('thumbnail img has width="100%" attribute and css', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Video',
                meta: 'Channel',
                url: 'https://example.com',
                imageUrl: 'https://cdn.example.com/thumb.jpg',
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('width="100%"');
      expect(result.html).toContain('width: 100%');
    });

    it('thumbnail img has height: auto in css', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Video',
                meta: 'Channel',
                url: 'https://example.com',
                imageUrl: 'https://cdn.example.com/thumb.jpg',
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('height: auto');
      expect(result.html).not.toContain('height="');
    });

    it('thumbnail img does not have fixed pixel width or height', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Video',
                meta: 'Channel',
                url: 'https://example.com',
                imageUrl: 'https://cdn.example.com/thumb.jpg',
              },
            ],
          },
        ],
      });

      expect(result.html).not.toContain('width="168"');
      expect(result.html).not.toContain('height="94"');
    });

    it('mediaList row td has width: 100%', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Video',
                meta: 'Channel',
                url: 'https://example.com',
                imageUrl: 'https://cdn.example.com/thumb.jpg',
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('width: 100%');
    });

    it('renders mediaList item without imageUrl (text-only)', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Article',
                meta: 'Source · Date',
                url: 'https://example.com/article',
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('Article');
      expect(result.html).toContain('Source · Date');
      expect(result.html).toContain('https://example.com/article');
      // Should not contain an img tag for this item
      expect(result.html.split('<img').length - 1).toBe(1); // only the logo img
    });

    it('renders mediaList item with null imageUrl (text-only)', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Article',
                meta: 'Source · Date',
                url: 'https://example.com/article',
                imageUrl: null,
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('Article');
      expect(result.html).not.toContain('src="null"');
      expect(result.html.split('<img').length - 1).toBe(1); // only the logo img
    });

    it('renders mediaList in text version as dash-separated lines', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'mediaList',
            items: [
              {
                title: 'Video One',
                meta: 'Channel A',
                url: 'https://example.com/v1',
              },
              {
                title: 'Video Two',
                meta: 'Channel B',
                url: 'https://example.com/v2',
              },
            ],
          },
        ],
      });

      expect(result.text).toContain('- Video One (Channel A): https://example.com/v1');
      expect(result.text).toContain('- Video Two (Channel B): https://example.com/v2');
    });
  });

  describe('footnote block rendering', () => {
    it('renders footnote text', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'footnote',
            text: 'We never store your passwords.',
          },
        ],
      });

      expect(result.html).toContain('We never store your passwords.');
    });

    it('renders footnote links separated by middot', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'footnote',
            text: 'Privacy policy',
            links: [
              { label: 'Privacy', url: 'https://example.com/privacy' },
              { label: 'Terms', url: 'https://example.com/terms' },
            ],
          },
        ],
      });

      expect(result.html).toContain('Privacy policy');
      expect(result.html).toContain('href="https://example.com/privacy"');
      expect(result.html).toContain('href="https://example.com/terms"');
      expect(result.html).toContain('Privacy');
      expect(result.html).toContain('Terms');
      expect(result.html).toContain('&middot;');
    });

    it('escapes footnote text', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'footnote',
            text: 'Tom & Jerry <love> cookies',
          },
        ],
      });

      expect(result.html).toContain('Tom &amp; Jerry &lt;love&gt; cookies');
      expect(result.html).not.toContain('Tom & Jerry');
    });

    it('escapes footnote link labels and urls', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'footnote',
            text: 'Links',
            links: [
              {
                label: 'Click "here" & go',
                url: 'https://example.com?a=1&b=2"onclick="alert(1)',
              },
            ],
          },
        ],
      });

      expect(result.html).toContain('Click &quot;here&quot; &amp; go');
      expect(result.html).toContain('&amp;b=2&quot;onclick=&quot;alert(1)');
      expect(result.html).not.toContain('onclick="alert(1)');
    });

    it('renders footnote without links', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'footnote',
            text: 'Just text, no links.',
          },
        ],
      });

      expect(result.html).toContain('Just text, no links.');
      // Should not have any links in this footnote (but still has footer unsubscribe if notification)
    });

    it('renders footnote in text version as text followed by link lines', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'footnote',
            text: 'Learn more',
            links: [
              { label: 'Privacy', url: 'https://example.com/privacy' },
              { label: 'Terms', url: 'https://example.com/terms' },
            ],
          },
        ],
      });

      expect(result.text).toContain('Learn more');
      expect(result.text).toContain('Privacy: https://example.com/privacy');
      expect(result.text).toContain('Terms: https://example.com/terms');
    });

    it('footnote with no links renders link line omitted in html', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [
          {
            kind: 'footnote',
            text: 'Standalone text',
            links: [],
          },
        ],
      });

      expect(result.html).toContain('Standalone text');
      // Should not have a link line since links array is empty
      const footnoteSection = result.html.substring(
        result.html.indexOf('Standalone text'),
      );
      expect(footnoteSection).not.toContain('href');
    });
  });

  describe('EMAIL_BRAND_NAME export', () => {
    it('exports EMAIL_BRAND_NAME as MyOrganizer', () => {
      expect(EMAIL_BRAND_NAME).toBe('MyOrganizer');
    });

    it('EMAIL_BRAND_NAME appears in html footer', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain(`© ${new Date().getFullYear()} ${EMAIL_BRAND_NAME}`);
    });

    it('EMAIL_BRAND_NAME appears in html title tag', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain(`<title>${EMAIL_BRAND_NAME}</title>`);
    });

    it('EMAIL_BRAND_NAME appears in logo alt text', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.html).toContain(`alt="${EMAIL_BRAND_NAME}"`);
    });

    it('EMAIL_BRAND_NAME appears in text footer', () => {
      const result = renderEmailShell({
        emailClass: 'transactional',
        preheader: 'Test',
        blocks: [],
      });

      expect(result.text).toContain(`© ${new Date().getFullYear()} ${EMAIL_BRAND_NAME}`);
    });
  });
});
