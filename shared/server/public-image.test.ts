import { describe, expect, it } from 'vitest';
import { getPublicImageSize, hasPublicImage } from './public-image';

describe('getPublicImageSize', () => {
  it('returns dimensions for an image stored under public', () => {
    expect(getPublicImageSize('/next.svg')).toEqual({
      width: 394,
      height: 80,
    });
  });

  it('does not treat external URLs as public files', () => {
    expect(getPublicImageSize('https://example.com/image.png')).toBeNull();
    expect(getPublicImageSize('//example.com/image.png')).toBeNull();
  });

  it('rejects path traversal outside the public directory', () => {
    expect(getPublicImageSize('/../package.json')).toBeNull();
  });
});

describe('hasPublicImage', () => {
  it('returns whether a public-root image exists', () => {
    expect(hasPublicImage('/next.svg')).toBe(true);
    expect(hasPublicImage('/missing-image.png')).toBe(false);
  });

  it('does not treat external URLs or path traversal as public images', () => {
    expect(hasPublicImage('https://example.com/image.png')).toBe(false);
    expect(hasPublicImage('/../package.json')).toBe(false);
  });
});
