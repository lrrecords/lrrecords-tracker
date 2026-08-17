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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile) {
    // Profile row is created by a DB trigger on sign-up; this should be instant,
    // but just in case, send them back to login rather than crashing.
    redirect('/login?error=Your%20profile%20is%20still%20being%20set%20up.%20Please%20try%20again.');
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <NavBar profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
