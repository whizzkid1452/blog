'use client';

import { useEffect, useState } from 'react';

export const SITE_HEADER_VISIBILITY_VIEWPORT_RATIO = 0.3;

interface SiteHeaderVisibilityMeasurements {
  scrollPosition: number;
  viewportHeight: number;
}

interface CreateSiteHeaderVisibilityHandlerParams {
  readScrollPosition: () => number;
  readViewportHeight: () => number;
  onVisibilityChange: (isVisible: boolean) => void;
}

export function shouldShowSiteHeader({ scrollPosition, viewportHeight }: SiteHeaderVisibilityMeasurements): boolean {
  return scrollPosition >= viewportHeight * SITE_HEADER_VISIBILITY_VIEWPORT_RATIO;
}

export function createSiteHeaderVisibilityHandler({
  readScrollPosition,
  readViewportHeight,
  onVisibilityChange,
}: CreateSiteHeaderVisibilityHandlerParams): () => void {
  return () => {
    onVisibilityChange(
      shouldShowSiteHeader({ scrollPosition: readScrollPosition(), viewportHeight: readViewportHeight() })
    );
  };
}

export function useSiteHeaderVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = createSiteHeaderVisibilityHandler({
      readScrollPosition: () => window.scrollY,
      readViewportHeight: () => window.innerHeight,
      onVisibilityChange: setIsVisible,
    });

    handleVisibilityChange();
    window.addEventListener('scroll', handleVisibilityChange, { passive: true });
    window.addEventListener('resize', handleVisibilityChange);

    return () => {
      window.removeEventListener('scroll', handleVisibilityChange);
      window.removeEventListener('resize', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
