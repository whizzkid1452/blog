interface ValidateMarkdownSeoParams {
  fileName: string;
  content: string;
  internalRoutes: ReadonlySet<string>;
  hasPublicImage?: (src: string) => boolean;
}

interface MarkdownResource {
  kind: 'image' | 'link';
  label: string;
  destination: string;
}

const MARKDOWN_RESOURCE_PATTERN = /(!?)\[([^\]]*)]\(([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\)/g;
const FENCED_CODE_BLOCK_PATTERN = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g;
const PROTOCOL_RELATIVE_URL_PREFIX = '//';
const ROOT_PATH = '/';

export function validateMarkdownSeo({
  fileName,
  content,
  internalRoutes,
  hasPublicImage,
}: ValidateMarkdownSeoParams): void {
  const issues = findMarkdownSeoIssues({ content, internalRoutes, hasPublicImage });

  if (issues.length === 0) {
    return;
  }

  throw new Error(`Invalid Markdown SEO content in ${fileName}: ${issues.join('; ')}`);
}

function findMarkdownSeoIssues({
  content,
  internalRoutes,
  hasPublicImage,
}: Pick<ValidateMarkdownSeoParams, 'content' | 'internalRoutes' | 'hasPublicImage'>): string[] {
  const searchableContent = removeFencedCodeBlocks(content);
  const resources = collectMarkdownResources(searchableContent);

  return resources.flatMap(resource => getMarkdownResourceIssues({ resource, internalRoutes, hasPublicImage }));
}

function collectMarkdownResources(content: string): MarkdownResource[] {
  return Array.from(content.matchAll(MARKDOWN_RESOURCE_PATTERN)).map(match => ({
    kind: match[1] === '!' ? 'image' : 'link',
    label: match[2].trim(),
    destination: match[3].trim(),
  }));
}

function getMarkdownResourceIssues({
  resource,
  internalRoutes,
  hasPublicImage,
}: {
  resource: MarkdownResource;
  internalRoutes: ReadonlySet<string>;
  hasPublicImage?: (src: string) => boolean;
}): string[] {
  const issues: string[] = [];

  if (resource.kind === 'image' && resource.label === '') {
    issues.push(`image "${resource.destination}" requires alt text`);
  }

  if (resource.kind === 'image' && hasPublicImage != null && isPublicPath(resource.destination)) {
    if (!hasPublicImage(resource.destination)) {
      issues.push(`image "${resource.destination}" does not match a public asset`);
    }
  }

  const internalPath = getInternalRoutePath(resource.destination);

  if (resource.kind === 'link' && internalPath != null && !internalRoutes.has(internalPath)) {
    issues.push(`internal link "${resource.destination}" does not match a generated route`);
  }

  return issues;
}

function getInternalRoutePath(destination: string): string | null {
  if (!isPublicPath(destination)) {
    return null;
  }

  return normalizeInternalPath(new URL(destination, 'https://example.com').pathname);
}

function isPublicPath(destination: string): boolean {
  return destination.startsWith(ROOT_PATH) && !destination.startsWith(PROTOCOL_RELATIVE_URL_PREFIX);
}

function normalizeInternalPath(pathname: string): string {
  if (pathname === ROOT_PATH) {
    return pathname;
  }

  return pathname.endsWith(ROOT_PATH) ? pathname.slice(0, -1) : pathname;
}

function removeFencedCodeBlocks(content: string): string {
  return content.replace(FENCED_CODE_BLOCK_PATTERN, '');
}
