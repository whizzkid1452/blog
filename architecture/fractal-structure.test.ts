import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const LEGACY_SOURCE_DIRECTORIES = ['components', 'lib'];
const RELOCATED_SOURCE_EXTENSIONS = new Set(['.css', '.ts', '.tsx']);

describe('fractal source structure', () => {
  it('keeps feature code out of legacy layer-oriented root directories', () => {
    const legacySourceFiles = LEGACY_SOURCE_DIRECTORIES.flatMap(directoryName =>
      collectRelocatedSourceFiles(path.join(PROJECT_ROOT, directoryName))
    );

    expect(legacySourceFiles).toEqual([]);
  });

  it('co-locates component styles with the component that imports them', () => {
    const featureSourceFiles = collectRelocatedSourceFiles(path.join(PROJECT_ROOT, 'features'));
    const componentFiles = featureSourceFiles.filter(filePath => filePath.endsWith('.tsx'));
    const nonLocalStyleImports = componentFiles.flatMap(filePath => findNonLocalStyleImports(filePath));

    expect(nonLocalStyleImports).toEqual([]);
  });
});

function collectRelocatedSourceFiles(directoryPath: string): string[] {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap(directoryEntry => {
    const entryPath = path.join(directoryPath, directoryEntry.name);

    if (directoryEntry.isDirectory()) {
      return collectRelocatedSourceFiles(entryPath);
    }

    if (!RELOCATED_SOURCE_EXTENSIONS.has(path.extname(directoryEntry.name))) {
      return [];
    }

    return [path.relative(PROJECT_ROOT, entryPath)];
  });
}

function findNonLocalStyleImports(filePath: string): string[] {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, filePath), 'utf8');
  const styleImportPattern = /from ['"]([^'"]+\.module\.css)['"]/g;

  return Array.from(source.matchAll(styleImportPattern)).flatMap(match => {
    const importPath = match[1];

    if (importPath.startsWith('./') && !importPath.slice(2).includes('/')) {
      return [];
    }

    return [`${filePath}: ${importPath}`];
  });
}
