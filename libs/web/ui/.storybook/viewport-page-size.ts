/**
 * Resolves a story's `parameters.viewport` into a concrete Playwright page
 * size.
 *
 * The Storybook test-runner drives stories through a Playwright page whose
 * viewport it never touches, so `parameters.viewport` is inert during a
 * play function: a story that declares `mobile1` still renders at the
 * desktop-sized default, and any width-sensitive hook (`useIsMobile`) stays
 * false. `.storybook/test-runner.ts` closes that gap by resizing the page in
 * `preVisit`, and this module holds the pure part of that decision so it can
 * be unit tested.
 */

export type PageSize = {
  width: number;
  height: number;
};

export type ViewportStyles = {
  width?: string;
  height?: string;
};

export type ViewportDefinition = {
  styles?: ViewportStyles | null;
};

export type ViewportParameter = {
  defaultViewport?: string;
  viewports?: Record<string, ViewportDefinition>;
};

/**
 * Size used for every story that does not name a viewport. The test-runner
 * reuses one page across the stories in a file, so a story that resized the
 * page would otherwise leak that size into its neighbours.
 */
export const DEFAULT_PAGE_SIZE: PageSize = { width: 1280, height: 720 };

/**
 * The viewport addon's `MINIMAL_VIEWPORTS`, which is what a story gets when it
 * names a viewport without declaring one. Inlined because the addon is not an
 * installed dependency of this workspace — `@storybook/addon-essentials` is
 * named in `main.ts` but is in neither `yarn.lock` nor `node_modules`.
 *
 * Copied from Storybook 8.6. If the Storybook pin in `TECH_STACK.md` moves,
 * re-check these against the addon's `MINIMAL_VIEWPORTS`.
 */
const MINIMAL_VIEWPORTS: Record<string, ViewportDefinition> = {
  mobile1: { styles: { width: '320px', height: '568px' } },
  mobile2: { styles: { width: '414px', height: '896px' } },
  tablet: { styles: { width: '834px', height: '1112px' } },
};

/** Storybook's sentinel for "no viewport selected". */
const RESET_VIEWPORT = 'reset';

function parsePixels(value: string | undefined, key: string): number {
  const match = /^(\d+)px$/.exec((value ?? '').trim());

  if (!match) {
    throw new Error(
      `Viewport "${key}" has a non-pixel dimension (${String(value)}). ` +
        'The Storybook test-runner can only resize the page to pixel sizes.',
    );
  }

  return Number(match[1]);
}

export function resolveViewportPageSize(
  parameter: ViewportParameter | undefined,
): PageSize {
  const key = parameter?.defaultViewport;

  if (!key || key === RESET_VIEWPORT) {
    return DEFAULT_PAGE_SIZE;
  }

  const definition = parameter?.viewports?.[key] ?? MINIMAL_VIEWPORTS[key];

  if (!definition) {
    throw new Error(
      `Unknown Storybook viewport "${key}". Declare it in ` +
        '`parameters.viewport.viewports` or use one of: ' +
        `${Object.keys(MINIMAL_VIEWPORTS).join(', ')}.`,
    );
  }

  return {
    width: parsePixels(definition.styles?.width, key),
    height: parsePixels(definition.styles?.height, key),
  };
}
