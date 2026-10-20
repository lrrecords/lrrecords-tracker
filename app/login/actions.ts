'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const fullName = String(formData.get('full_name') || '').trim();

  if (password.length < 8) {
    redirect(`/login?mode=signup&error=${encodeURIComponent('Password must be at least 8 characters.')}`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        task_interests: formData.getAll('task_interests').map(String).slice(0, 10),
        weekly_hours: String(formData.get('weekly_hours') || '').slice(0, 50),
        relationship: String(formData.get('relationship') || '').slice(0, 80),
        application_note: String(formData.get('application_note') || '').trim().slice(0, 2000),
      },
    },
  });

  if (error) {
    redirect(`/login?mode=signup&error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
