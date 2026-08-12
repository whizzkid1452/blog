import type { PostSummary } from '@/features/posts/model/post';
import { describe, expect, it } from 'vitest';
import { resolveSiteHeaderTitle } from './site-header-title';

const posts: PostSummary[] = [
  {
    slug: 'electron-multi-window-shared-data-ssot',
    title: 'Electron에서는 공유 데이터를 어디에 둬야 할까?',
    date: '2026-07-15',
    tags: ['electron'],
    visibility: 'public',
  },
];

describe('resolveSiteHeaderTitle', () => {
  it('글 경로에 해당하는 글 제목을 반환한다', () => {
    expect(
      resolveSiteHeaderTitle({
        locale: 'ko',
        pathname: '/posts/electron-multi-window-shared-data-ssot',
        posts,
      })
    ).toBe('Electron에서는 공유 데이터를 어디에 둬야 할까?');
  });

  it('태그 경로의 URL encoding을 해제한다', () => {
    expect(
      resolveSiteHeaderTitle({
        locale: 'ko',
        pathname: '/tags/state%20management',
        posts,
      })
    ).toBe('#state management');
  });

  it('고정 페이지에 해당하는 현지화된 제목을 반환한다', () => {
    expect(resolveSiteHeaderTitle({ locale: 'ko', pathname: '/private-posts', posts })).toBe('비공개 글');
    expect(resolveSiteHeaderTitle({ locale: 'ko', pathname: '/posts', posts })).toBe('전체 글');
    expect(resolveSiteHeaderTitle({ locale: 'ko', pathname: '/series', posts })).toBe('시리즈');
  });

  it('알 수 없는 경로나 일치하지 않는 글은 사이트 이름으로 fallback한다', () => {
    expect(resolveSiteHeaderTitle({ locale: 'ko', pathname: '/posts/missing', posts })).toBe('앨리스의 토끼굴');
    expect(resolveSiteHeaderTitle({ locale: 'ko', pathname: '/unknown', posts })).toBe('앨리스의 토끼굴');
  });
});
