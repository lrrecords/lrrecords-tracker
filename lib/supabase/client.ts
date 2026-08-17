import { createBrowserClient } from '@supabase/ssr';

// Deliberately NOT parameterized with a Database generic — see the comment
// in lib/database.types.ts for why. Row shapes are enforced at each call
// site instead, via `.single<T>()` / `.returns<T[]>()` and typed payload
// variables (e.g. `const update: Partial<Settings> = {...}`).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
