'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user: user! };
}

export async function addSong(formData: FormData) {
  const { supabase, user } = await requireUser();
  const title = String(formData.get('title') || '').trim();
  if (!title) return;

  await supabase.from('songs').insert({
    title,
    status: String(formData.get('status') || 'idea'),
    notes: String(formData.get('notes') || '').trim(),
    created_by: user.id,
  });

  revalidatePath('/studio');
}

export async function updateSongStatus(songId: string, formData: FormData) {
  const { supabase } = await requireUser();
  await supabase
    .from('songs')
    .update({ status: String(formData.get('status') || 'idea') })
    .eq('id', songId);
  revalidatePath('/studio');
}

export async function addTimeEntry(songId: string | null, formData: FormData) {
  const { supabase, user } = await requireUser();

  const hours = Number(formData.get('hours') || 0);
  const task_description = String(formData.get('task_description') || '').trim();
  if (!task_description || hours <= 0) return;

  await supabase.from('studio_time_entries').insert({
    song_id: songId,
    task_description,
    hours,
    entry_date: String(formData.get('entry_date') || '') || new Date().toISOString().slice(0, 10),
    logged_by: user.id,
    notes: String(formData.get('notes') || '').trim(),
  });

  revalidatePath('/studio');
}

export async function deleteTimeEntry(entryId: string) {
  const { supabase } = await requireUser();
  await supabase.from('studio_time_entries').delete().eq('id', entryId);
  revalidatePath('/studio');
}

export async function markUnlockUsed(unlockId: string, formData: FormData) {
  const { supabase } = await requireUser();
  await supabase
    .from('studio_unlocks')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      notes: String(formData.get('notes') || '').trim(),
    })
    .eq('id', unlockId);
  revalidatePath('/studio');
}
