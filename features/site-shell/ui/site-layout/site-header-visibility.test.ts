import { describe, expect, it, vi } from 'vitest';
import {
  createSiteHeaderVisibilityHandler,
  SITE_HEADER_VISIBILITY_VIEWPORT_RATIO,
  shouldShowSiteHeader,
} from './site-header-visibility';

const VIEWPORT_HEIGHT = 1_000;
const VISIBILITY_THRESHOLD = VIEWPORT_HEIGHT * SITE_HEADER_VISIBILITY_VIEWPORT_RATIO;

describe('shouldShowSiteHeader', () => {
  it('keeps the header hidden before scrolling 30% of the viewport height', () => {
    expect(shouldShowSiteHeader({ scrollPosition: VISIBILITY_THRESHOLD - 1, viewportHeight: VIEWPORT_HEIGHT })).toBe(
      false
    );
  });

  it('shows the header after scrolling 30% of the viewport height', () => {
    expect(shouldShowSiteHeader({ scrollPosition: VISIBILITY_THRESHOLD, viewportHeight: VIEWPORT_HEIGHT })).toBe(true);
  });
});

describe('createSiteHeaderVisibilityHandler', () => {
  it('reports visibility from the current scroll position', () => {
    let scrollPosition = 0;
    const onVisibilityChange = vi.fn();
    const handleScroll = createSiteHeaderVisibilityHandler({
      readScrollPosition: () => scrollPosition,
      readViewportHeight: () => VIEWPORT_HEIGHT,
      onVisibilityChange,
    });

    handleScroll();
    scrollPosition = VISIBILITY_THRESHOLD;
    handleScroll();

    expect(onVisibilityChange).toHaveBeenNthCalledWith(1, false);
    expect(onVisibilityChange).toHaveBeenNthCalledWith(2, true);
  });
});
