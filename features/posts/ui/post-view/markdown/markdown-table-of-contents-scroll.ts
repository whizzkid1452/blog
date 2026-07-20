interface HeadingPosition {
  id: string;
  top: number;
}

interface FindActiveHeadingIdParams {
  activationOffset: number;
  headingPositions: HeadingPosition[];
  isDocumentEnd?: boolean;
  retainedHeadingId?: string | null;
}

interface ScrollToTableOfContentsHeadingParams {
  prefersReducedMotion: boolean;
  scrollIntoView: (options: ScrollIntoViewOptions) => void;
}

interface FindTableOfContentsScrollTopParams {
  containerBottom: number;
  containerTop: number;
  currentScrollTop: number;
  itemBottom: number;
  itemTop: number;
}

export function scrollToTableOfContentsHeading({
  prefersReducedMotion,
  scrollIntoView,
}: ScrollToTableOfContentsHeadingParams) {
  scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
}

export function findTableOfContentsScrollTop({
  containerBottom,
  containerTop,
  currentScrollTop,
  itemBottom,
  itemTop,
}: FindTableOfContentsScrollTopParams): number {
  const containerCenter = (containerTop + containerBottom) / 2;
  const itemCenter = (itemTop + itemBottom) / 2;

  return Math.max(0, currentScrollTop + itemCenter - containerCenter);
}

export function findActiveHeadingId({
  activationOffset,
  headingPositions,
  isDocumentEnd = false,
  retainedHeadingId,
}: FindActiveHeadingIdParams): string | null {
  if (retainedHeadingId != null) {
    return retainedHeadingId;
  }

  const firstHeading = headingPositions[0];

  if (firstHeading == null) {
    return null;
  }

  if (isDocumentEnd) {
    return headingPositions.at(-1)?.id ?? null;
  }

  let activeHeadingId = firstHeading.id;

  for (const headingPosition of headingPositions) {
    if (headingPosition.top > activationOffset) {
      break;
    }

    activeHeadingId = headingPosition.id;
  }

  return activeHeadingId;
}
