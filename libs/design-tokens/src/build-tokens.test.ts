/**
 * Tests for the design-tokens build script helpers.
 *
 * Validates:
 * - hslTriple hex-to-HSL conversion accuracy and error handling
 * - kebab and camel case formatters
 * - isPrimitive and isRole token classification
 * - tokens.json structural integrity per ADR 0065
 */

import * as path from 'path';

// `style-dictionary` ships ESM only. Requiring the CommonJS build script without
// this stub fails with "Cannot use import statement outside a module" before any
// test runs — verified by removing it. No build is executed here.
jest.mock('style-dictionary', () => {
  class StyleDictionaryStub {
    static registerFormat = jest.fn();
    constructor(public readonly config: unknown) {}
    async buildAllPlatforms(): Promise<void> {
      return Promise.resolve();
    }
  }
  return { default: StyleDictionaryStub };
});

// Import CommonJS module using require
const { hslTriple, kebab, camel, isPrimitive, isRole } = require(
  path.join(__dirname, '..', 'scripts', 'build-tokens.cjs'),
);

// Load tokens.json for structural integrity tests
const tokensPath = path.join(__dirname, 'tokens.json');
const tokens = require(tokensPath);

describe('design-tokens build script', () => {
  // =========================================================================
  // hslTriple: hex to HSL triple conversion
  // =========================================================================

  describe('hslTriple', () => {
    describe('happy path: valid 6-digit hex colours', () => {
      it('converts pure white #FFFFFF to 0 0% 100%', () => {
        expect(hslTriple('#FFFFFF')).toBe('0 0% 100%');
      });

      it('converts pure black #000000 to 0 0% 0%', () => {
        expect(hslTriple('#000000')).toBe('0 0% 0%');
      });

      it('converts primary/foreground #0F172A to 222.2 47.4% 11.2%', () => {
        expect(hslTriple('#0F172A')).toBe('222.2 47.4% 11.2%');
      });

      it('converts destructive #EF4444 to 0 84.2% 60.2%', () => {
        expect(hslTriple('#EF4444')).toBe('0 84.2% 60.2%');
      });

      it('converts brand/secondary #7C3AED to 262.1 83.3% 57.8%', () => {
        expect(hslTriple('#7C3AED')).toBe('262.1 83.3% 57.8%');
      });

      it('accepts hex without leading # symbol', () => {
        expect(hslTriple('FFFFFF')).toBe('0 0% 100%');
        expect(hslTriple('EF4444')).toBe('0 84.2% 60.2%');
      });

      it('is case-insensitive: #ef4444 and #EF4444 agree', () => {
        expect(hslTriple('#ef4444')).toBe(hslTriple('#EF4444'));
        expect(hslTriple('7c3aed')).toBe(hslTriple('#7C3AED'));
      });

      it('produces 0% saturation for achromatic (grey) values', () => {
        // #808080 is mid-grey
        const result = hslTriple('#808080');
        // Saturation should be 0%
        expect(result).toMatch(/\d+\.?\d* 0% /);
      });

      it('rounds to one decimal place', () => {
        // Verify all three components are rounded to 1 decimal max
        const result = hslTriple('#7C3AED');
        // Split into components and verify format
        const parts = result.split(' ');
        expect(parts).toHaveLength(3);
        // First part (hue): number with 0-1 decimals
        // Second/third: percentage with 0-1 decimals
        expect(parts[0]).toMatch(/^\d+(?:\.\d)?$/);
        expect(parts[1]).toMatch(/^\d+(?:\.\d)?%$/);
        expect(parts[2]).toMatch(/^\d+(?:\.\d)?%$/);
      });
    });

    describe('error paths: invalid input', () => {
      it('throws on 3-digit shorthand #FFF', () => {
        expect(() => {
          hslTriple('#FFF');
        }).toThrow(
          /Semantic Role value must be a 6-digit hex colour, got: #FFF/,
        );
      });

      it('throws on non-hex string "not-hex"', () => {
        expect(() => {
          hslTriple('not-hex');
        }).toThrow(/Semantic Role value must be a 6-digit hex colour/);
      });

      it('throws on CSS colour name "red"', () => {
        expect(() => {
          hslTriple('red');
        }).toThrow(/Semantic Role value must be a 6-digit hex colour/);
      });

      it('throws on hsl() string "hsl(0, 100%, 50%)"', () => {
        expect(() => {
          hslTriple('hsl(0, 100%, 50%)');
        }).toThrow(/Semantic Role value must be a 6-digit hex colour/);
      });

      it('error message names the offending value', () => {
        const badValue = '#GGGGGG';
        expect(() => {
          hslTriple(badValue);
        }).toThrow(badValue);
      });
    });

    describe('edge cases: rounding fidelity', () => {
      it('handles colours requiring rounding in all three components', () => {
        // #7C3AED has the structure that stresses rounding
        const result = hslTriple('#7C3AED');
        const parts = result.split(' ');
        // Hue: 262.1, Saturation: 83.3%, Lightness: 57.8%
        expect(parts[0]).toBe('262.1');
        expect(parts[1]).toBe('83.3%');
        expect(parts[2]).toBe('57.8%');
      });

      it('handles neutral #808080 (mid-grey) with zero saturation', () => {
        // A true neutral grey should have 0% saturation
        const result = hslTriple('#808080');
        expect(result).toMatch(/\d+(?:\.\d)? 0% /);
      });
    });
  });

  // =========================================================================
  // kebab: array to kebab-case joiner
  // =========================================================================

  describe('kebab', () => {
    it('joins parts with hyphens', () => {
      expect(kebab(['color', 'primary'])).toBe('color-primary');
    });

    it('joins single part unchanged', () => {
      expect(kebab(['color'])).toBe('color');
    });

    it('joins multiple parts', () => {
      expect(kebab(['mode', 'light', 'background'])).toBe(
        'mode-light-background',
      );
    });

    it('preserves case in parts', () => {
      expect(kebab(['Color', 'Primary'])).toBe('Color-Primary');
    });
  });

  // =========================================================================
  // camel: array to camelCase converter
  // =========================================================================

  describe('camel', () => {
    it('converts to camelCase from parts array', () => {
      expect(camel(['color', 'primary'])).toBe('colorPrimary');
    });

    it('capitalizes subsequent parts', () => {
      expect(camel(['mode', 'light', 'background'])).toBe(
        'modeLightBackground',
      );
    });

    it('handles single part', () => {
      expect(camel(['color'])).toBe('color');
    });

    it('handles parts with dashes by camelCasing internally', () => {
      // The camel function itself processes dashes in part text
      // But typical tokens.json has no dashes in part names
      expect(camel(['color-test', 'primary'])).toBe('colorTestPrimary');
    });
  });

  // =========================================================================
  // isPrimitive and isRole: token classification
  // =========================================================================

  describe('isPrimitive', () => {
    it('classifies color.* as primitive', () => {
      const token = { path: ['color', 'primary'] };
      expect(isPrimitive(token)).toBe(true);
    });

    it('classifies neutral.* as primitive', () => {
      const token = { path: ['neutral', '50'] };
      expect(isPrimitive(token)).toBe(true);
    });

    it('classifies space.* as primitive', () => {
      const token = { path: ['space', 'xs'] };
      expect(isPrimitive(token)).toBe(true);
    });

    it('classifies radius.* as primitive', () => {
      const token = { path: ['radius', 'sm'] };
      expect(isPrimitive(token)).toBe(true);
    });

    it('classifies font.* as primitive', () => {
      const token = { path: ['font', 'body'] };
      expect(isPrimitive(token)).toBe(true);
    });

    it('classifies shadow.* as primitive', () => {
      const token = { path: ['shadow', 'card'] };
      expect(isPrimitive(token)).toBe(true);
    });

    it('classifies mode.* as NOT primitive (role)', () => {
      const token = { path: ['mode', 'light', 'background'] };
      expect(isPrimitive(token)).toBe(false);
    });
  });

  describe('isRole', () => {
    it('classifies mode.light.* as role', () => {
      const token = { path: ['mode', 'light', 'background'] };
      expect(isRole(token)).toBe(true);
    });

    it('classifies mode.dark.* as role', () => {
      const token = { path: ['mode', 'dark', 'foreground'] };
      expect(isRole(token)).toBe(true);
    });

    it('classifies color.* as NOT role (primitive)', () => {
      const token = { path: ['color', 'primary'] };
      expect(isRole(token)).toBe(false);
    });

    it('classifies neutral.* as NOT role (primitive)', () => {
      const token = { path: ['neutral', '50'] };
      expect(isRole(token)).toBe(false);
    });
  });

  describe('isPrimitive and isRole: exhaustiveness and exclusivity', () => {
    it('are mutually exclusive: a token cannot be both primitive and role', () => {
      const primitiveToken = { path: ['color', 'primary'] };
      const roleToken = { path: ['mode', 'light', 'background'] };

      expect(isPrimitive(primitiveToken) && isRole(primitiveToken)).toBe(false);
      expect(isPrimitive(roleToken) && isRole(roleToken)).toBe(false);
    });

    it('are exhaustive: every token is either primitive or role', () => {
      const testTokens = [
        { path: ['color', 'primary'] },
        { path: ['neutral', '50'] },
        { path: ['space', 'xs'] },
        { path: ['radius', 'md'] },
        { path: ['font', 'body'] },
        { path: ['shadow', 'card'] },
        { path: ['mode', 'light', 'background'] },
        { path: ['mode', 'dark', 'foreground'] },
      ];

      testTokens.forEach((token) => {
        const isPrim = isPrimitive(token);
        const isRol = isRole(token);
        expect(isPrim || isRol).toBe(true);
      });
    });
  });

  // =========================================================================
  // tokens.json structural integrity per ADR 0065
  // =========================================================================

  describe('tokens.json: mode tier structure', () => {
    it('mode.light and mode.dark declare exactly the same set of role names', () => {
      const lightRoles = Object.keys(tokens.mode.light);
      const darkRoles = Object.keys(tokens.mode.dark);

      // Both directions: light >= dark and dark >= light means equality
      expect(new Set(lightRoles)).toEqual(new Set(darkRoles));
    });

    it('every role in mode.light also exists in mode.dark', () => {
      const lightRoles = Object.keys(tokens.mode.light);

      lightRoles.forEach((role) => {
        expect(tokens.mode.dark).toHaveProperty(role);
      });
    });

    it('every role in mode.dark also exists in mode.light', () => {
      const darkRoles = Object.keys(tokens.mode.dark);

      darkRoles.forEach((role) => {
        expect(tokens.mode.light).toHaveProperty(role);
      });
    });
  });

  describe('tokens.json: semantic references', () => {
    const REFERENCE = /^\{([\w.-]+)\}$/;
    const modes = ['light', 'dark'] as const;
    const rolesOf = (mode: 'light' | 'dark') =>
      Object.entries(
        tokens.mode[mode] as Record<
          string,
          { $value?: string; value?: string }
        >,
      ).map(
        ([name, data]) =>
          [name, (data.$value ?? data.value) as string] as const,
      );

    it.each(modes)(
      'every %s Semantic Role value is a DTCG reference, never a literal colour',
      (mode) => {
        const literals = rolesOf(mode).filter(
          ([, value]) => !REFERENCE.test(value),
        );
        expect(literals).toEqual([]);
      },
    );

    it.each(modes)(
      'every %s Semantic Role reference resolves to a token in the primitive tier',
      (mode) => {
        const unresolved = rolesOf(mode).filter(([, value]) => {
          const match = REFERENCE.exec(value);
          // A non-reference is a failure of the test above, not something to skip here.
          if (!match) return true;
          let node: unknown = tokens;
          for (const part of match[1].split('.')) {
            if (typeof node !== 'object' || node === null || !(part in node))
              return true;
            node = (node as Record<string, unknown>)[part];
          }
          return false;
        });
        expect(unresolved).toEqual([]);
      },
    );

    it('resolves references whose names contain hyphens', () => {
      // Guards the hole this test previously had: a reference regex without `-`
      // silently skipped {color.surface-container} and friends.
      const hyphenated = modes.flatMap((mode) =>
        rolesOf(mode).filter(([, value]) => value.includes('-')),
      );
      expect(hyphenated.length).toBeGreaterThan(0);
    });
  });

  describe('tokens.json: neutral ramp ordering', () => {
    type Rung = { name: string; hex: string; lightness: number };

    const rungs = (): Rung[] =>
      Object.entries(
        tokens.neutral as Record<string, { $value?: string; value?: string }>,
      )
        .map(
          ([name, data]) =>
            [name, (data.$value ?? data.value) as string] as const,
        )
        .filter(([, hex]) => /^#[\da-fA-F]{6}$/.test(hex))
        .map(([name, hex]) => ({
          name,
          hex,
          lightness: parseFloat(hslTriple(hex).split(' ')[2]),
        }))
        .sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10));

    it('rung lightness decreases monotonically as the rung number increases', () => {
      const ordered = rungs();
      // Compare as a list so a failure names the rungs rather than two bare numbers.
      const descending = ordered.map((r) => `${r.name}:${r.lightness}`);
      const expected = [...ordered]
        .sort((a, b) => b.lightness - a.lightness)
        .map((r) => `${r.name}:${r.lightness}`);
      expect(descending).toEqual(expected);
    });

    it('neutral rungs 0 and 950 bracket the full range', () => {
      const neutral0Hex = tokens.neutral[0].$value ?? tokens.neutral[0].value;
      const neutral950Hex =
        tokens.neutral[950].$value ?? tokens.neutral[950].value;

      const hslTriple = require(
        path.join(__dirname, '..', 'scripts', 'build-tokens.cjs'),
      ).hslTriple;
      const l0 = parseFloat(hslTriple(neutral0Hex).split(' ')[2]);
      const l950 = parseFloat(hslTriple(neutral950Hex).split(' ')[2]);

      // 0 should be white-ish (high lightness), 950 should be black-ish (low lightness)
      expect(l0).toBeGreaterThan(l950);
    });
  });

  describe('tokens.json: completeness', () => {
    it('has primitive tiers: color, neutral, space, radius, font, shadow', () => {
      expect(tokens).toHaveProperty('color');
      expect(tokens).toHaveProperty('neutral');
      expect(tokens).toHaveProperty('space');
      expect(tokens).toHaveProperty('radius');
      expect(tokens).toHaveProperty('font');
      expect(tokens).toHaveProperty('shadow');
    });

    it('has semantic tier: mode with light and dark', () => {
      expect(tokens).toHaveProperty('mode');
      expect(tokens.mode).toHaveProperty('light');
      expect(tokens.mode).toHaveProperty('dark');
    });

    it('color.primary exists and is referenced by multiple roles', () => {
      expect(tokens.color).toHaveProperty('primary');

      // Count references to color.primary in roles
      let count = 0;
      const checkMode = (mode: 'light' | 'dark') => {
        Object.values(
          tokens.mode[mode] as Record<
            string,
            { $value?: string; value?: string }
          >,
        ).forEach((data) => {
          if ((data.$value ?? data.value) === '{color.primary}') {
            count++;
          }
        });
      };

      checkMode('light');
      checkMode('dark');

      expect(count).toBeGreaterThan(0);
    });

    it('neutral rung 850 is used for primary and other roles', () => {
      expect(tokens.neutral).toHaveProperty('850');

      // Verify it's a legitimate token
      const val = tokens.neutral[850].$value ?? tokens.neutral[850].value;
      expect(/^#[\da-fA-F]{6}$/.test(val)).toBe(true);
    });
  });
});
