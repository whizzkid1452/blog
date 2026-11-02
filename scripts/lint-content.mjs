import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { findContentTextViolations } from './markdown-content-lint.mjs';

const CONTENT_DIRECTORIES = ['content/posts', 'content/til'];
let fileCount = 0;
let violationCount = 0;

for (const directory of CONTENT_DIRECTORIES) {
  const fileNames = readdirSync(directory, { recursive: true })
    .filter(fileName => fileName.endsWith('.md'))
    .sort();

  for (const fileName of fileNames) {
    const filePath = path.join(directory, fileName);
    const source = readFileSync(filePath, 'utf8');
    const violations = findContentTextViolations({ source });
    fileCount += 1;

    for (const violation of violations) {
      violationCount += 1;
      const message =
        violation.symbol === '·'
          ? '가운뎃점(·)은 사용할 수 없습니다. 쉼표나 자연스러운 연결 표현으로 바꿔 주세요.'
          : `본문에 마크다운 기호 "${violation.symbol}"가 그대로 표시됩니다. 문법을 수정하거나 예제를 코드로 감싸 주세요.`;

      console.error(`${filePath}:${violation.line}:${violation.column} error ${message}`);
    }
  }
}

if (violationCount > 0) {
  console.error(`콘텐츠 린트 실패: ${fileCount}개 파일에서 ${violationCount}개 오류를 발견했습니다.`);
  process.exitCode = 1;
} else {
  console.log(`콘텐츠 린트 통과: ${fileCount}개 Markdown 파일에서 금지 문자와 노출된 마크다운 기호가 없습니다.`);
}
