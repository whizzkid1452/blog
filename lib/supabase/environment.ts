import { z } from 'zod';

const supabaseEnvironmentSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
});

export interface SupabaseEnvironment {
  url: string;
  publishableKey: string;
}

export function getSupabaseEnvironment(): SupabaseEnvironment {
  const environment = supabaseEnvironmentSchema.parse(process.env);

  return {
    url: environment.SUPABASE_URL,
    publishableKey: environment.SUPABASE_PUBLISHABLE_KEY,
  };
}
