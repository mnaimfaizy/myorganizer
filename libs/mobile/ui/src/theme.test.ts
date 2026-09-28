import { lightTheme, darkTheme, themeForMode } from './theme';
import { resolveColorMode } from './appearance';
import {
  typeScale,
  toRnSize,
  toRnLetterSpacing,
  toRnFontWeight,
  FONT_FAMILY,
} from './typeScale';

describe('Mobile App Theme Resolution', () => {
  describe('1. Both colour modes expose the same Semantic Role set', () => {
    it('should have identical role keys in light and dark themes', () => {
      const lightKeys = Object.keys(lightTheme.colors).sort();
      const darkKeys = Object.keys(darkTheme.colors).sort();
      expect(lightKeys).toEqual(darkKeys);
    });
  });

  describe('2. Five new roles present in both modes with approved values', () => {
    it('should have errorText with correct light (#b91c1c) and dark (#f87171) values', () => {
      expect(lightTheme.colors.errorText).toBe('#b91c1c');
      expect(darkTheme.colors.errorText).toBe('#f87171');
    });

    it('should have focus with correct light (#7c3aed) and dark (#a78bfa) values', () => {
      expect(lightTheme.colors.focus).toBe('#7c3aed');
      expect(darkTheme.colors.focus).toBe('#a78bfa');
    });

    it('should have controlEdge with correct light (#7f8ea3) and dark (#64748b) values', () => {
      expect(lightTheme.colors.controlEdge).toBe('#7f8ea3');
      expect(darkTheme.colors.controlEdge).toBe('#64748b');
    });

    it('should have raisedSurface with correct light (#ffffff) and dark (#0f172a) values', () => {
      expect(lightTheme.colors.raisedSurface).toBe('#ffffff');
      expect(darkTheme.colors.raisedSurface).toBe('#0f172a');
    });

    it('should have scrim with correct light (rgba(3, 7, 17, 0.45)) and dark (rgba(2, 2, 5, 0.6)) values', () => {
      expect(lightTheme.colors.scrim).toBe('rgba(3, 7, 17, 0.45)');
      expect(darkTheme.colors.scrim).toBe('rgba(2, 2, 5, 0.6)');
    });
  });

  describe('3. Light and dark differ where they should', () => {
    it('should have different background colors', () => {
      expect(lightTheme.colors.background).not.toBe(
        darkTheme.colors.background,
      );
      expect(lightTheme.colors.background).toBe('#f8fafc');
      expect(darkTheme.colors.background).toBe('#030711');
    });

    it('should report their own mode', () => {
      expect(lightTheme.mode).toBe('light');
      expect(darkTheme.mode).toBe('dark');
    });
  });

  describe('4. Light destructive role is the new red', () => {
    it('should have destructive role as #dc2626 in light theme', () => {
      expect(lightTheme.colors.destructive).toBe('#dc2626');
    });
  });

  describe('5. Appearance resolution', () => {
    it('should return light when appearance is light regardless of system scheme', () => {
      expect(resolveColorMode('light', 'dark')).toBe('light');
      expect(resolveColorMode('light', 'light')).toBe('light');
      expect(resolveColorMode('light', null)).toBe('light');
      expect(resolveColorMode('light', undefined)).toBe('light');
    });

    it('should return dark when appearance is dark regardless of system scheme', () => {
      expect(resolveColorMode('dark', 'light')).toBe('dark');
      expect(resolveColorMode('dark', 'dark')).toBe('dark');
      expect(resolveColorMode('dark', null)).toBe('dark');
      expect(resolveColorMode('dark', undefined)).toBe('dark');
    });

    it('should return dark when appearance is system and system scheme is dark', () => {
      expect(resolveColorMode('system', 'dark')).toBe('dark');
    });

    it('should return light when appearance is system and system scheme is light', () => {
      expect(resolveColorMode('system', 'light')).toBe('light');
    });

    it('should return light when appearance is system and system scheme is null or undefined', () => {
      expect(resolveColorMode('system', null)).toBe('light');
      expect(resolveColorMode('system', undefined)).toBe('light');
    });
  });

  describe('6. themeForMode returns correct identity', () => {
    it('should return lightTheme for light mode', () => {
      expect(themeForMode('light')).toBe(lightTheme);
    });

    it('should return darkTheme for dark mode', () => {
      expect(themeForMode('dark')).toBe(darkTheme);
    });
  });

  describe('7. Type scale converts to React Native numbers with correct values', () => {
    const typeScaleTests = [
      {
        step: 'display',
        expectedFontSize: 34,
        expectedLineHeight: 40,
        expectedFontWeight: '800',
      },
      {
        step: 'titleLg',
        expectedFontSize: 28,
        expectedLineHeight: 34,
        expectedFontWeight: '700',
      },
      {
        step: 'title',
        expectedFontSize: 20,
        expectedLineHeight: 26,
        expectedFontWeight: '700',
      },
      {
        step: 'body',
        expectedFontSize: 17,
        expectedLineHeight: 24,
        expectedFontWeight: '400',
      },
      {
        step: 'bodySm',
        expectedFontSize: 15,
        expectedLineHeight: 20,
        expectedFontWeight: '400',
      },
      {
        step: 'labelCaps',
        expectedFontSize: 12,
        expectedLineHeight: 16,
        expectedFontWeight: '600',
      },
      {
        step: 'caption',
        expectedFontSize: 13,
        expectedLineHeight: 18,
        expectedFontWeight: '400',
      },
    ];

    it.each(typeScaleTests)(
      'should have $step with fontSize=$expectedFontSize, lineHeight=$expectedLineHeight, fontWeight=$expectedFontWeight',
      ({ step, expectedFontSize, expectedLineHeight, expectedFontWeight }) => {
        const typeStep = typeScale[step as keyof typeof typeScale];
        expect(typeof typeStep.fontSize).toBe('number');
        expect(typeof typeStep.lineHeight).toBe('number');
        expect(typeStep.fontSize).toBe(expectedFontSize);
        expect(typeStep.lineHeight).toBe(expectedLineHeight);
        expect(typeStep.fontWeight).toBe(expectedFontWeight);
      },
    );
  });

  describe('8. Letter-spacing is converted from em to points', () => {
    it('should have labelCaps letterSpacing as 12 * 0.02 = 0.24', () => {
      expect(typeScale.labelCaps.letterSpacing).toBe(0.24);
    });

    it('should have all other steps with letterSpacing of 0', () => {
      expect(typeScale.display.letterSpacing).toBe(0);
      expect(typeScale.titleLg.letterSpacing).toBe(0);
      expect(typeScale.title.letterSpacing).toBe(0);
      expect(typeScale.body.letterSpacing).toBe(0);
      expect(typeScale.bodySm.letterSpacing).toBe(0);
      expect(typeScale.caption.letterSpacing).toBe(0);
    });
  });

  describe('9. labelCaps is the only step with textTransform: uppercase', () => {
    it('should have textTransform uppercase on labelCaps', () => {
      expect(typeScale.labelCaps.textTransform).toBe('uppercase');
    });

    it('should not have textTransform on other steps', () => {
      expect(typeScale.display.textTransform).toBeUndefined();
      expect(typeScale.titleLg.textTransform).toBeUndefined();
      expect(typeScale.title.textTransform).toBeUndefined();
      expect(typeScale.body.textTransform).toBeUndefined();
      expect(typeScale.bodySm.textTransform).toBeUndefined();
      expect(typeScale.caption.textTransform).toBeUndefined();
    });
  });

  describe('10. Each step names a bundled font file', () => {
    const fontFamilyTests = [
      { step: 'display', expectedFamily: FONT_FAMILY.displayExtraBold },
      { step: 'titleLg', expectedFamily: FONT_FAMILY.displayBold },
      { step: 'title', expectedFamily: FONT_FAMILY.displayBold },
      { step: 'body', expectedFamily: FONT_FAMILY.bodyRegular },
      { step: 'bodySm', expectedFamily: FONT_FAMILY.bodyRegular },
      { step: 'labelCaps', expectedFamily: FONT_FAMILY.bodySemiBold },
      { step: 'caption', expectedFamily: FONT_FAMILY.bodyRegular },
    ];

    it.each(fontFamilyTests)(
      'should have $step with fontFamily=$expectedFamily',
      ({ step, expectedFamily }) => {
        const typeStep = typeScale[step as keyof typeof typeScale];
        expect(typeStep.fontFamily).toBe(expectedFamily);
      },
    );

    it('should have all font families defined in FONT_FAMILY', () => {
      expect(FONT_FAMILY.displayExtraBold).toBe('PlusJakartaSans-ExtraBold');
      expect(FONT_FAMILY.displayBold).toBe('PlusJakartaSans-Bold');
      expect(FONT_FAMILY.bodyRegular).toBe('Inter-Regular');
      expect(FONT_FAMILY.bodySemiBold).toBe('Inter-SemiBold');
    });
  });

  describe('11. Conversion helpers', () => {
    describe('toRnSize', () => {
      it('should convert pixel values', () => {
        expect(toRnSize('16px')).toBe(16);
        expect(toRnSize('12px')).toBe(12);
        expect(toRnSize('34px')).toBe(34);
      });

      it('should convert rem values to pixels (1rem = 16px)', () => {
        expect(toRnSize('1rem')).toBe(16);
        expect(toRnSize('1.5rem')).toBe(24);
        expect(toRnSize('0.5rem')).toBe(8);
      });

      it('should throw for non-numeric values', () => {
        expect(() => toRnSize('abc')).toThrow(
          'Design token is not a usable length',
        );
        expect(() => toRnSize('invalid')).toThrow(
          'Design token is not a usable length',
        );
      });
    });

    describe('toRnLetterSpacing', () => {
      it('should convert em tracking to points', () => {
        expect(toRnLetterSpacing('0.02em', 12)).toBe(0.24);
        expect(toRnLetterSpacing('0em', 12)).toBe(0);
        expect(toRnLetterSpacing('0.01em', 100)).toBe(1);
      });

      it('should throw for non-em values', () => {
        expect(() => toRnLetterSpacing('0.02px', 12)).toThrow(
          'Type-scale tracking must be in em',
        );
        expect(() => toRnLetterSpacing('0.02', 12)).toThrow(
          'Type-scale tracking must be in em',
        );
      });
    });

    describe('toRnFontWeight', () => {
      it('should accept bundled weights', () => {
        expect(toRnFontWeight('400')).toBe('400');
        expect(toRnFontWeight('600')).toBe('600');
        expect(toRnFontWeight('700')).toBe('700');
        expect(toRnFontWeight('800')).toBe('800');
      });

      it('should throw for unbundled weights', () => {
        expect(() => toRnFontWeight('500')).toThrow(
          'Type-scale weight is not one this app bundles',
        );
        expect(() => toRnFontWeight('250')).toThrow(
          'Type-scale weight is not one this app bundles',
        );
        expect(() => toRnFontWeight('900')).toThrow(
          'Type-scale weight is not one this app bundles',
        );
      });
    });
  });

  describe('12. Spacing and radii are numbers, mode-independent', () => {
    it('should have spacing.md === 16 on both themes', () => {
      expect(lightTheme.spacing.md).toBe(16);
      expect(darkTheme.spacing.md).toBe(16);
      expect(typeof lightTheme.spacing.md).toBe('number');
      expect(typeof darkTheme.spacing.md).toBe('number');
    });

    it('should have radii.md === 8 on both themes', () => {
      expect(lightTheme.radii.md).toBe(8);
      expect(darkTheme.radii.md).toBe(8);
      expect(typeof lightTheme.radii.md).toBe('number');
      expect(typeof darkTheme.radii.md).toBe('number');
    });

    it('should have all spacing values as numbers', () => {
      expect(typeof lightTheme.spacing.xs).toBe('number');
      expect(typeof lightTheme.spacing.sm).toBe('number');
      expect(typeof lightTheme.spacing.lg).toBe('number');
      expect(typeof lightTheme.spacing.xl).toBe('number');
      expect(typeof lightTheme.spacing.gutter).toBe('number');
    });

    it('should have all radii values as numbers', () => {
      expect(typeof lightTheme.radii.sm).toBe('number');
      expect(typeof lightTheme.radii.lg).toBe('number');
      expect(typeof lightTheme.radii.xl).toBe('number');
      expect(typeof lightTheme.radii['2xl']).toBe('number');
      expect(typeof lightTheme.radii.full).toBe('number');
    });

    it('should have identical spacing values on light and dark', () => {
      expect(lightTheme.spacing.xs).toBe(darkTheme.spacing.xs);
      expect(lightTheme.spacing.sm).toBe(darkTheme.spacing.sm);
      expect(lightTheme.spacing.md).toBe(darkTheme.spacing.md);
      expect(lightTheme.spacing.lg).toBe(darkTheme.spacing.lg);
      expect(lightTheme.spacing.xl).toBe(darkTheme.spacing.xl);
      expect(lightTheme.spacing.gutter).toBe(darkTheme.spacing.gutter);
    });

    it('should have identical radii values on light and dark', () => {
      expect(lightTheme.radii.sm).toBe(darkTheme.radii.sm);
      expect(lightTheme.radii.md).toBe(darkTheme.radii.md);
      expect(lightTheme.radii.lg).toBe(darkTheme.radii.lg);
      expect(lightTheme.radii.xl).toBe(darkTheme.radii.xl);
      expect(lightTheme.radii['2xl']).toBe(darkTheme.radii['2xl']);
      expect(lightTheme.radii.full).toBe(darkTheme.radii.full);
    });
  });
});
