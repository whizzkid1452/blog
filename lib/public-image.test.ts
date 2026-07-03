import { describe, expect, it } from 'vitest';
import { getPublicImageSize } from './public-image';

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
