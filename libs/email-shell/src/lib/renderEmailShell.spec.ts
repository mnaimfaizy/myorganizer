import {
  colorBorder,
  colorCard,
  colorMuted,
  colorOnPrimary,
  colorPrimary,
  colorSurface,
} from '@myorganizer/design-tokens';
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
});
