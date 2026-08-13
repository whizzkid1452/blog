import type { NextConfig } from 'next';

// Vercel의 Next.js 기본 빌드 출력을 사용하므로 standalone 출력 모드를 지정하지 않는다.
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/resume',
        destination: 'https://notion.site/38073b56612a80efb6e1f5f7055e5c15',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
