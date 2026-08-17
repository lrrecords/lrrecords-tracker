import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Deliberately NOT parameterized with a Database generic — see the comment
// in lib/database.types.ts for why. Row shapes are enforced at each call
// site instead, via `.single<T>()` / `.returns<T[]>()` and typed payload
// variables (e.g. `const update: Partial<Settings> = {...}`).
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component render — safe to ignore because
            // middleware.ts refreshes the session cookie on every request.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // See note above.
          }
        },
      },
    }
  );
}
