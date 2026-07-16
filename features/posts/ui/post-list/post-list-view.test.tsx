import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PostListView } from './post-list-view';

describe('PostListView', () => {
  it('renders the site name on the entry screen', () => {
    const markup = renderToStaticMarkup(<PostListView posts={[]} />);

    expect(markup).toContain('>앨리스의 토끼굴</h1>');
  });
});
