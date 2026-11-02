import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findRawMarkdownMarkers } from './markdown-content-lint.mjs';

describe('Markdown content lint', () => {
  it.each([
    ["수작업을 **'구조적으로 소거'**하여 자동화했습니다.", '**'],
    ['닫히지 않은 **강조', '**'],
    ['##공백 없는 제목', '##'],
    ['본문 중간의 ### 제목', '###'],
    ['<p>**HTML 안의 본문**</p>', '**'],
    ['\\*\\*이스케이프한 기호', '**'],
    ['&#35;&#35; 엔티티로 작성한 기호', '##'],
    ['[##잘못된 링크 문구](https://example.com)', '##'],
  ])('reports markers exposed in rendered text: %s', (source, marker) => {
    expect(findRawMarkdownMarkers({ source })).toEqual(expect.arrayContaining([expect.objectContaining({ marker })]));
  });

  it('allows valid headings, emphasis, and code examples', () => {
    const source = [
      '## [sort1] 1. 정상 제목',
      '',
      '**정상 강조**와 __다른 강조__, ~~취소선~~을 사용합니다.',
      '',
      '`**기호**`, `## 제목`, `10 ** 2`는 코드 예제입니다.',
      '',
      '```md',
      '##제목 예제',
      '**닫히지 않은 강조 예제',
      '```',
      '',
      '    ## 들여쓴 코드',
      '',
      '<pre>## 원문 코드</pre>',
      '',
      '<code>**인라인 코드**</code>',
      '',
      '[문서](https://example.com/##fragment)',
    ].join('\n');

    expect(findRawMarkdownMarkers({ source })).toEqual([]);
  });

  it('reports source lines including frontmatter and skips frontmatter values', () => {
    const source = ['---', "title: '**제목의 메타데이터**'", '---', '', '정상 본문', '##잘못된 제목'].join('\n');

    expect(findRawMarkdownMarkers({ source })).toEqual([{ marker: '##', line: 6, column: 1 }]);
  });

  it('matches the page renderer trimming leading whitespace while retaining source locations', () => {
    const source = '\n\n    ##제목';

    expect(findRawMarkdownMarkers({ source })).toEqual([{ marker: '##', line: 3, column: 5 }]);
  });

  it('fails the CLI for private posts and nested TIL files, then passes after correction', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'blog-content-lint-'));
    const scriptPath = fileURLToPath(new URL('./lint-content.mjs', import.meta.url));
    const postsDirectory = path.join(directory, 'content/posts');
    const tilDirectory = path.join(directory, 'content/til/archive');
    mkdirSync(postsDirectory, { recursive: true });
    mkdirSync(tilDirectory, { recursive: true });

    try {
      writeFileSync(path.join(postsDirectory, 'private.md'), '---\nvisibility: private\n---\n\n**미완성 강조');
      writeFileSync(path.join(tilDirectory, 'entry.md'), '##잘못된 제목');

      const failed = spawnSync(process.execPath, [scriptPath], { cwd: directory, encoding: 'utf8' });

      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain('content/posts/private.md:5:1 error');
      expect(failed.stderr).toContain('content/til/archive/entry.md:1:1 error');

      writeFileSync(path.join(postsDirectory, 'private.md'), '수정한 본문');
      writeFileSync(path.join(tilDirectory, 'entry.md'), '## 정상 제목');

      const passed = spawnSync(process.execPath, [scriptPath], { cwd: directory, encoding: 'utf8' });

      expect(passed.status).toBe(0);
      expect(passed.stdout).toContain('콘텐츠 린트 통과: 2개 Markdown 파일');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
