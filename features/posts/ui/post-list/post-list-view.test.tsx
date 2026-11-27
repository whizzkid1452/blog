import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PostListView } from './post-list-view';

describe('PostListView', () => {
  it('renders the site name on the entry screen', () => {
    const markup = renderToStaticMarkup(<PostListView posts={[]} />);

    expect(markup).toContain('>앨리스의 토끼굴</h1>');
  });

  it('renders the blog direction on the entry screen', () => {
    const markup = renderToStaticMarkup(<PostListView posts={[]} />);

    expect(markup).toContain(
      '빠르게 훑고 지나가기보다, 앨리스가 흰 토끼를 따라 토끼굴로 들어가듯 끝까지 파고드는 개발을 지향합니다.'
    );
  });

  it('does not render an eyebrow when it is omitted', () => {
    const markup = renderToStaticMarkup(<PostListView posts={[]} />);

    expect(markup).not.toContain('Personal notes');
  });

  it('starts the home content with the calendar instead of a visible intro panel', () => {
    const markup = renderToStaticMarkup(
      <PostListView
        posts={[{ slug: 'example', title: 'Example post', date: '2026-07-16', tags: [], visibility: 'public' }]}
        headerVariant="none"
        beforePosts={<div>Today I Learned</div>}
      />
    );

    expect(markup).toContain('>앨리스의 토끼굴</h1>');
    expect(markup).toContain('visuallyHidden');
    expect(markup).toContain('Today I Learned');
    expect(markup.indexOf('Today I Learned')).toBeLessThan(markup.indexOf('href="/posts/example"'));
    expect(markup).not.toContain('SAVE POINT');
    expect(markup).not.toContain('전체 글 읽기');
    expect(markup).not.toContain('POSTS IN MEMORY');
    expect(markup).not.toContain('빠르게 훑고 지나가기보다');
  });

  it('renders the archive heading and posts without the intro panel', () => {
    const markup = renderToStaticMarkup(
      <PostListView
        posts={[{ slug: 'example', title: 'Example post', date: '2026-07-16', tags: [], visibility: 'public' }]}
        title="전체 글"
        headerVariant="title"
      />
    );

    expect(markup).toContain('>전체 글</h1>');
    expect(markup).toContain('href="/posts/example"');
    expect(markup).not.toContain('SAVE POINT');
    expect(markup).not.toContain('전체 글 읽기');
    expect(markup).not.toContain('POSTS IN MEMORY');
  });
});
