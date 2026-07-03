const DESCRIPTION_MAX_LENGTH = 160;
const ELLIPSIS_LENGTH = 1;

export function createPostDescription({ description, content }: { description?: string; content: string }): string {
  if (description != null && description.trim() !== '') {
    return description.trim();
  }

  const firstParagraph = content
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .find(isDescriptionCandidate);

  if (firstParagraph == null) {
    return '';
  }

  return normalizeDescription(firstParagraph);
}

function isDescriptionCandidate(paragraph: string): boolean {
  return paragraph !== '' && !paragraph.startsWith('#') && !paragraph.startsWith('```');
}

function normalizeDescription(value: string): string {
  const plainText = value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= DESCRIPTION_MAX_LENGTH) {
    return plainText;
  }

  return `${plainText.slice(0, DESCRIPTION_MAX_LENGTH - ELLIPSIS_LENGTH).trim()}...`;
}
