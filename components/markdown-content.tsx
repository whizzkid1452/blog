'use client';

import styled from '@emotion/styled';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const blocks = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <Content>
      {blocks.map((block) => {
        if (block.startsWith('## ')) {
          return <Heading key={block}>{block.replace(/^## /, '')}</Heading>;
        }

        if (block.startsWith('# ')) {
          return <Title key={block}>{block.replace(/^# /, '')}</Title>;
        }

        return <Paragraph key={block}>{block}</Paragraph>;
      })}
    </Content>
  );
}

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  color: #3f3f46;
  font-size: 16px;
  line-height: 2;
`;

const Title = styled.h2`
  margin: 0;
  color: #18181b;
  font-size: 30px;
  font-weight: 650;
  line-height: 1.25;
`;

const Heading = styled.h2`
  margin: 16px 0 0;
  color: #18181b;
  font-size: 24px;
  font-weight: 650;
  line-height: 1.3;
`;

const Paragraph = styled.p`
  margin: 0;
`;
