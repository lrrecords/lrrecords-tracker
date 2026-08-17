'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Profile, Settings } from '@/lib/database.types';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (profile?.role !== 'admin') redirect('/tasks');

  return { supabase, user: user! };
}

export async function updateSettings(formData: FormData) {
  const { supabase } = await requireAdmin();

  const tasksRequired = Number(formData.get('tasks_required_for_studio') || 4);
  const hoursPerUnlock = Number(formData.get('studio_hours_per_unlock') || 2);

  const settingsUpdate: Partial<Settings> = {
    tasks_required_for_studio: Math.max(1, Math.round(tasksRequired)),
    studio_hours_per_unlock: Math.max(0, hoursPerUnlock),
  };

  await supabase.from('settings').update(settingsUpdate).eq('id', 1);

  revalidatePath('/admin/settings');
  revalidatePath('/studio');
}

export async function updateProfileRole(profileId: string, role: 'admin' | 'student') {
  const { supabase } = await requireAdmin();
  const roleUpdate: Partial<Profile> = { role };
  await supabase.from('profiles').update(roleUpdate).eq('id', profileId);
  revalidatePath('/admin/settings');
}
