interface SearchParameters {
  q?: string | string[];
}

export function getSearchQuery({ q }: SearchParameters): string {
  return Array.isArray(q) ? (q[0] ?? '') : (q ?? '');
}
