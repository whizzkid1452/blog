const HEALTH_RESPONSE_BODY = {
  status: 'ok',
} as const;

export const dynamic = 'force-dynamic';

export function GET(): Response {
  // Load Balancer가 캐시가 아닌 현재 서버 프로세스의 응답을 확인하게 한다.
  return Response.json(HEALTH_RESPONSE_BODY, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
