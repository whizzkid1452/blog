import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';

const LOCAL_URL_BASE = 'https://local.invalid';
const PROTOCOL_RELATIVE_URL_PREFIX = '//';
const PUBLIC_DIRECTORY = path.join(process.cwd(), 'public');

export interface PublicImageSize {
  width: number;
  height: number;
}

const publicImageSizeCache = new Map<string, PublicImageSize | null>();

export function getPublicImageSize(src: string): PublicImageSize | null {
  const cachedSize = publicImageSizeCache.get(src);

  if (cachedSize !== undefined) {
    return cachedSize;
  }

  const size = readPublicImageSize(src);
  publicImageSizeCache.set(src, size);

  return size;
}

function readPublicImageSize(src: string): PublicImageSize | null {
  const imagePath = getPublicImagePath(src);

  if (imagePath == null || !fs.existsSync(imagePath)) {
    return null;
  }

  try {
    const dimensions = imageSize(fs.readFileSync(imagePath));

    if (dimensions.width == null || dimensions.height == null) {
      return null;
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch {
    return null;
  }
}

function getPublicImagePath(src: string): string | null {
  if (!src.startsWith('/') || src.startsWith(PROTOCOL_RELATIVE_URL_PREFIX)) {
    return null;
  }

  const pathname = parseLocalPathname(src);

  if (pathname == null) {
    return null;
  }

  const imagePath = path.resolve(PUBLIC_DIRECTORY, `.${pathname}`);

  if (!isPathInsideDirectory(imagePath, PUBLIC_DIRECTORY)) {
    return null;
  }

  return imagePath;
}

function parseLocalPathname(src: string): string | null {
  try {
    return decodeURIComponent(new URL(src, LOCAL_URL_BASE).pathname);
  } catch {
    return null;
  }
}

function isPathInsideDirectory(targetPath: string, directoryPath: string): boolean {
  const relativePath = path.relative(directoryPath, targetPath);

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
