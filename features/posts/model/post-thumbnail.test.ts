import { describe, expect, it } from 'vitest';
import { getFirstPostContentImage } from './post-thumbnail';

describe('getFirstPostContentImage', () => {
  it('returns the first Markdown image with its alternative text', () => {
    const content = ['Intro', '![First diagram](/images/first.png)', '![Second diagram](/images/second.png)'].join(
      '\n'
    );

    expect(getFirstPostContentImage(content)).toEqual({
      src: '/images/first.png',
      alt: 'First diagram',
    });
  });

  it('returns an HTML image when it appears before a Markdown image', () => {
    const content = [
      '<p><img alt="First image" src="/images/first.jpg" /></p>',
      '![Second image](/images/second.png)',
    ].join('\n');

    expect(getFirstPostContentImage(content)).toEqual({
      src: '/images/first.jpg',
      alt: 'First image',
    });
  });

  it('ignores image syntax inside fenced code blocks', () => {
    const content = ['```md', '![Example](/images/example.png)', '```', 'Body without an image'].join('\n');

    expect(getFirstPostContentImage(content)).toBeNull();
  });

  it('returns null when the post content has no image', () => {
    expect(getFirstPostContentImage('Post content without an image.')).toBeNull();
  });
});
