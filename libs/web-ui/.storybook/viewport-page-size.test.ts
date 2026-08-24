import {
  DEFAULT_PAGE_SIZE,
  resolveViewportPageSize,
} from './viewport-page-size';

describe('viewport-page-size', () => {
  describe('resolveViewportPageSize', () => {
    it('should return the default desktop size when the story sets no viewport parameter', () => {
      expect(resolveViewportPageSize(undefined)).toEqual(DEFAULT_PAGE_SIZE);
    });

    it('should return the default desktop size when the parameter names no default viewport', () => {
      expect(resolveViewportPageSize({ viewports: {} })).toEqual(
        DEFAULT_PAGE_SIZE,
      );
    });

    it('should return the default desktop size when the named viewport is the reset sentinel', () => {
      expect(resolveViewportPageSize({ defaultViewport: 'reset' })).toEqual(
        DEFAULT_PAGE_SIZE,
      );
    });

    it('should return the built-in dimensions when the parameter names a minimal viewport', () => {
      expect(resolveViewportPageSize({ defaultViewport: 'mobile1' })).toEqual({
        width: 320,
        height: 568,
      });
      expect(resolveViewportPageSize({ defaultViewport: 'tablet' })).toEqual({
        width: 834,
        height: 1112,
      });
    });

    it('should prefer the story-declared viewport when it shadows a built-in key', () => {
      expect(
        resolveViewportPageSize({
          defaultViewport: 'mobile1',
          viewports: {
            mobile1: { styles: { width: '360px', height: '640px' } },
          },
        }),
      ).toEqual({ width: 360, height: 640 });
    });

    it('should throw when the named viewport is neither built in nor declared', () => {
      expect(() =>
        resolveViewportPageSize({ defaultViewport: 'mobile9' }),
      ).toThrow(/mobile9/);
    });

    it('should throw when the declared viewport styles are not pixel dimensions', () => {
      expect(() =>
        resolveViewportPageSize({
          defaultViewport: 'fluid',
          viewports: { fluid: { styles: { width: '100%', height: '100%' } } },
        }),
      ).toThrow(/fluid/);
    });
  });
});
