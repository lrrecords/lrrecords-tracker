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

// ---------- create a task (admin) ----------
export async function createTask(formData: FormData) {
  const { supabase, user } = await requireUser();

  const title = String(formData.get('title') || '').trim();
  if (!title) return;

  const { data: studentProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'student')
    .limit(1)
    .maybeSingle();

  await supabase.from('tasks').insert({
    title,
    description: String(formData.get('description') || '').trim(),
    week_of: String(formData.get('week_of') || '') || null,
    due_date: String(formData.get('due_date') || '') || null,
    assigned_to: studentProfile?.id ?? null,
    created_by: user.id,
    status: 'pending',
  });

  revalidatePath('/tasks');
}

// ---------- edit task details (admin) ----------
export async function updateTaskDetails(taskId: string, formData: FormData) {
  const { supabase } = await requireUser();

  await supabase
    .from('tasks')
    .update({
      title: String(formData.get('title') || '').trim(),
      description: String(formData.get('description') || '').trim(),
      week_of: String(formData.get('week_of') || '') || null,
      due_date: String(formData.get('due_date') || '') || null,
    })
    .eq('id', taskId);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
}

// ---------- student moves status forward ----------
export async function updateTaskStatus(taskId: string, status: 'in_progress' | 'submitted' | 'pending') {
  const { supabase } = await requireUser();

  await supabase.from('tasks').update({ status }).eq('id', taskId);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
}

// ---------- admin sign-off toggle ----------
export async function toggleSignOff(taskId: string, signOff: boolean) {
  const { supabase } = await requireUser();

  await supabase
    .from('tasks')
    .update({ status: signOff ? 'signed_off' : 'submitted' })
    .eq('id', taskId);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
  revalidatePath('/studio');
}

// ---------- delete a task (admin) ----------
export async function deleteTask(taskId: string) {
  const { supabase } = await requireUser();
  await supabase.from('tasks').delete().eq('id', taskId);
  revalidatePath('/tasks');
  redirect('/tasks');
}

// ---------- add evidence (text / link / file / screenshot) ----------
export async function addEvidence(taskId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const type = String(formData.get('type') || 'text') as 'text' | 'link' | 'file' | 'screenshot';
  const content = String(formData.get('content') || '').trim();
  const file = formData.get('file') as File | null;

  let filePath: string | null = null;

  if ((type === 'file' || type === 'screenshot') && file && file.size > 0) {
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `${user.id}/${taskId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('evidence').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (!uploadError) {
      filePath = path;
    }
  }

  if (!content && !filePath) return;

  await supabase.from('task_evidence').insert({
    task_id: taskId,
    type,
    content,
    file_path: filePath,
    created_by: user.id,
  });

  // Submitting evidence implicitly moves a pending/in_progress task forward.
  await supabase
    .from('tasks')
    .update({ status: 'submitted' })
    .eq('id', taskId)
    .in('status', ['pending', 'in_progress']);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/tasks');
}

export async function deleteEvidence(taskId: string, evidenceId: string, filePath: string | null) {
  const { supabase } = await requireUser();
  await supabase.from('task_evidence').delete().eq('id', evidenceId);
  if (filePath) {
    await supabase.storage.from('evidence').remove([filePath]);
  }
  revalidatePath(`/tasks/${taskId}`);
}

// ---------- notes / feedback thread ----------
export async function addNote(taskId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const note = String(formData.get('note') || '').trim();
  if (!note) return;

  await supabase.from('task_notes').insert({
    task_id: taskId,
    author_id: user.id,
    note,
  });

  revalidatePath(`/tasks/${taskId}`);
}
