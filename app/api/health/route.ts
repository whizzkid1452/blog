const HEALTH_RESPONSE_BODY = {
  status: 'ok',
} as const;

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json(HEALTH_RESPONSE_BODY, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
