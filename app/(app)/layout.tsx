import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NavBar } from '@/components/NavBar';
import type { Profile } from '@/lib/database.types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile) {
    // Log the real Postgres/PostgREST error server-side (visible in Vercel's
    // runtime logs) instead of silently swallowing it — a missing profile
    // row and a permissions/RLS error look identical to the user otherwise.
    console.error('[AppLayout] profile fetch failed', {
      userId: user.id,
      email: user.email,
      error: profileError,
    });
    const detail = profileError
      ? ` (${profileError.code ?? 'no code'}: ${profileError.message})`
      : '';
    redirect(
      `/login?error=${encodeURIComponent(
        `Your profile is still being set up. Please try again.${detail}`
      )}`
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <NavBar profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
