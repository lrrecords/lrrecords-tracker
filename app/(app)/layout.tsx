import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NavBar } from '@/components/NavBar';
import { signOutAction } from '@/app/login/actions';
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

  const approved = profile.role === 'admin' || profile.status === 'approved';

  if (!approved) {
    const message =
      profile.status === 'pending'
        ? {
            title: 'Application received',
            body: 'Thanks for applying. Brett reviews every application and you’ll be able to pick up tasks here once you’re approved. Check back soon.',
          }
        : {
            title: 'Account not active',
            body: 'Your account isn’t active right now. If you think that’s a mistake, get in touch with LRRecords.',
          };
    return (
      <main className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-bold text-navy-900">{message.title}</h1>
          <p className="mt-2 text-sm text-navy-600">{message.body}</p>
          <form action={signOutAction} className="mt-4">
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <NavBar profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
