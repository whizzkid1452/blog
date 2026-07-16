import { describe, expect, it } from 'vitest';
import { findActiveTableOfContentsId } from './markdown-table-of-contents-view';

describe('findActiveTableOfContentsId', () => {
  it('returns null when there are no headings', () => {
    expect(findActiveTableOfContentsId({ activationOffset: 120, headingPositions: [] })).toBeNull();
  });

  it('returns the first heading before any heading reaches the activation offset', () => {
    expect(
      findActiveTableOfContentsId({
        activationOffset: 120,
        headingPositions: [
          { id: 'overview', top: 320 },
          { id: 'design', top: 640 },
        ],
      })
    ).toBe('overview');
  });

  it('returns the latest heading that passed the activation offset', () => {
    expect(
      findActiveTableOfContentsId({
        activationOffset: 120,
        headingPositions: [
          { id: 'overview', top: -240 },
          { id: 'design', top: 80 },
          { id: 'implementation', top: 460 },
        ],
      })
    ).toBe('design');
  });
});
