const FENCED_CODE_BLOCK_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*>/gi;
const HTML_IMAGE_SRC_PATTERN = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
const HTML_IMAGE_ALT_PATTERN = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;

export interface PostThumbnail {
  src: string;
  alt: string;
}

interface PositionedPostThumbnail extends PostThumbnail {
  index: number;
}

export function getFirstPostContentImage(content: string): PostThumbnail | null {
  const searchableContent = removeFencedCodeBlockContent(content);
  const markdownImage = findFirstMarkdownImage(searchableContent);
  const htmlImage = findFirstHtmlImage(searchableContent);
  const firstImage = getEarlierImage(markdownImage, htmlImage);

  if (firstImage == null) {
    return null;
  }

  return {
    src: firstImage.src,
    alt: firstImage.alt,
  };
}

function removeFencedCodeBlockContent(content: string): string {
  return content.replace(FENCED_CODE_BLOCK_PATTERN, match => ' '.repeat(match.length));
}

function findFirstMarkdownImage(content: string): PositionedPostThumbnail | null {
  const match = MARKDOWN_IMAGE_PATTERN.exec(content);
  MARKDOWN_IMAGE_PATTERN.lastIndex = 0;

  if (match == null) {
    return null;
  }

  return {
    index: match.index,
    src: match[2],
    alt: match[1],
  };
}

function findFirstHtmlImage(content: string): PositionedPostThumbnail | null {
  for (const match of content.matchAll(HTML_IMAGE_PATTERN)) {
    const src = getHtmlAttribute(match[0], HTML_IMAGE_SRC_PATTERN);

    if (src == null || src === '') {
      continue;
    }

    return {
      index: match.index,
      src,
      alt: getHtmlAttribute(match[0], HTML_IMAGE_ALT_PATTERN) ?? '',
    };
  }

  return null;
}

function getHtmlAttribute(imageElement: string, pattern: RegExp): string | null {
  const match = pattern.exec(imageElement);

  return match?.slice(1).find(value => value != null) ?? null;
}

function getEarlierImage(
  markdownImage: PositionedPostThumbnail | null,
  htmlImage: PositionedPostThumbnail | null
): PositionedPostThumbnail | null {
  if (markdownImage == null) {
    return htmlImage;
  }

  if (htmlImage == null) {
    return markdownImage;
  }

  return markdownImage.index < htmlImage.index ? markdownImage : htmlImage;
}
