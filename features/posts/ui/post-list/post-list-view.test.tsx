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
});
