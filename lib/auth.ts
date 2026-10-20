import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/database.types';

export async function getSessionProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile) redirect('/login');
  return { supabase, user: user!, profile: profile! };
}

export async function requireApproved() {
  const ctx = await getSessionProfile();
  if (ctx.profile.role !== 'admin' && ctx.profile.status !== 'approved') redirect('/tasks');
  return ctx;
}

export async function requireAdmin() {
  const ctx = await getSessionProfile();
  if (ctx.profile.role !== 'admin') redirect('/tasks');
  return ctx;
}

// Supabase RPC errors come back as "message"; surface them in the URL for the page to show.
export function errorRedirect(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
