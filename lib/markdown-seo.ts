interface ValidateMarkdownSeoParams {
  fileName: string;
  content: string;
  internalRoutes: ReadonlySet<string>;
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

export function validateMarkdownSeo({ fileName, content, internalRoutes }: ValidateMarkdownSeoParams): void {
  const issues = findMarkdownSeoIssues({ content, internalRoutes });

  if (issues.length === 0) {
    return;
  }

  throw new Error(`Invalid Markdown SEO content in ${fileName}: ${issues.join('; ')}`);
}

function findMarkdownSeoIssues({
  content,
  internalRoutes,
}: Pick<ValidateMarkdownSeoParams, 'content' | 'internalRoutes'>): string[] {
  const searchableContent = removeFencedCodeBlocks(content);
  const resources = collectMarkdownResources(searchableContent);

  return resources.flatMap(resource => getMarkdownResourceIssues({ resource, internalRoutes }));
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
}: {
  resource: MarkdownResource;
  internalRoutes: ReadonlySet<string>;
}): string[] {
  const issues: string[] = [];

  if (resource.kind === 'image' && resource.label === '') {
    issues.push(`image "${resource.destination}" requires alt text`);
  }

  const internalPath = getInternalRoutePath(resource.destination);

  if (resource.kind === 'link' && internalPath != null && !internalRoutes.has(internalPath)) {
    issues.push(`internal link "${resource.destination}" does not match a generated route`);
  }

  return issues;
}

function getInternalRoutePath(destination: string): string | null {
  if (!destination.startsWith(ROOT_PATH) || destination.startsWith(PROTOCOL_RELATIVE_URL_PREFIX)) {
    return null;
  }

  return normalizeInternalPath(new URL(destination, 'https://example.com').pathname);
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
