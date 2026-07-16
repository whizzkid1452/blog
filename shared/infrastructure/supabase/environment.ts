const SUPABASE_URL = 'https://vjftvegsxezhybbjtyvy.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8kdNiIsPQ8a0AwxIbHoazA_JZQwvtO4';

export interface SupabaseEnvironment {
  url: string;
  publishableKey: string;
}

export function getSupabaseEnvironment(): SupabaseEnvironment {
  // Publishable Key는 공개용 키이므로 배포 환경 설정 없이 동일한 Supabase 프로젝트를 사용하도록 고정한다.
  return {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
  };
}
