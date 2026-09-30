import { toRnShadow } from './shadows';

describe('Shadow Token Conversion', () => {
  describe('toRnShadow', () => {
    it('should parse standard CSS shadow format with px units', () => {
      const result = toRnShadow('0px 1px 3px rgba(15, 23, 42, 0.05)');
      expect(result).toEqual({
        shadowColor: 'rgb(15, 23, 42)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2, // Math.round(3 / 2) = 2
      });
    });

    it('should parse shadow format with unitless zero', () => {
      const result = toRnShadow('0 12px 24px rgba(0, 0, 0, 0.12)');
      expect(result).toEqual({
        shadowColor: 'rgb(0, 0, 0)',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12, // Math.round(24 / 2) = 12
      });
    });

    it('should round elevation correctly', () => {
      // blur 11 -> Math.round(11 / 2) = 6
      const result = toRnShadow('0 2px 11px rgba(15, 23, 42, 0.1)');
      expect(result.elevation).toBe(6);
    });

    it('should handle negative offsets', () => {
      const result = toRnShadow('-1px 2px 5px rgba(50, 60, 70, 0.2)');
      expect(result.shadowOffset).toEqual({ width: -1, height: 2 });
    });

    it('should handle decimal opacity values', () => {
      const result = toRnShadow('0 1px 3px rgba(15, 23, 42, 0.084)');
      expect(result.shadowOpacity).toBe(0.084);
    });

    it('should throw for malformed shadow tokens', () => {
      expect(() => toRnShadow('not a shadow')).toThrow(
        'Shadow token is not a usable box-shadow',
      );
      expect(() => toRnShadow('0 1px 3px red')).toThrow(
        'Shadow token is not a usable box-shadow',
      );
      expect(() => toRnShadow('0 1px 3px rgba(255, 255, 255)')).toThrow(
        'Shadow token is not a usable box-shadow',
      );
    });

    it('should trim whitespace from input', () => {
      const result = toRnShadow('  0px 1px 3px rgba(15, 23, 42, 0.05)  ');
      expect(result.shadowColor).toBe('rgb(15, 23, 42)');
    });
  });
});
