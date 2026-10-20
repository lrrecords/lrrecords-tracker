'use server';

import { revalidatePath } from 'next/cache';
import { errorRedirect, requireAdmin } from '@/lib/auth';
import type { MemberStatus, Role } from '@/lib/database.types';

export async function setMemberStatus(profileId: string, status: MemberStatus) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from('profiles')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', profileId);
  if (error) errorRedirect('/admin/members', error.message);
  revalidatePath('/admin/members');
}

export async function setMemberRole(profileId: string, role: Role) {
  const { supabase, user } = await requireAdmin();
  if (profileId === user.id) errorRedirect('/admin/members', 'You can’t change your own role.');
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
  if (error) errorRedirect('/admin/members', error.message);
  revalidatePath('/admin/members');
}

export async function adjustCoin(profileId: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc('adjust_coin', {
    p_profile: profileId,
    p_amount: Math.round(Number(formData.get('amount') || 0)),
    p_note: String(formData.get('note') || '').trim(),
  });
  if (error) errorRedirect('/admin/members', error.message);
  revalidatePath('/admin/members');
}

export async function decideRedemption(id: string, approve: boolean, formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc('decide_redemption', {
    p_id: id,
    p_approve: approve,
    p_note: String(formData.get('admin_note') || '').trim(),
  });
  if (error) errorRedirect('/admin/requests', error.message);
  revalidatePath('/admin/requests');
}

export async function completeRedemption(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc('complete_redemption', { p_id: id });
  if (error) errorRedirect('/admin/requests', error.message);
  revalidatePath('/admin/requests');
}

export async function saveCatalogueItem(id: string | null, formData: FormData) {
  const { supabase } = await requireAdmin();
  const priceRaw = String(formData.get('coin_price') || '').trim();
  const price = priceRaw ? Math.round(Number(priceRaw)) : null;
  const active = formData.get('active') === 'on';
  if (active && (!price || price < 1)) errorRedirect('/admin/catalogue', 'Set a coin price before showing an item to members.');
  const fields = {
    name: String(formData.get('name') || '').trim(),
    kind: String(formData.get('kind') || 'other'),
    unit: String(formData.get('unit') || 'each').trim() || 'each',
    description: String(formData.get('description') || '').trim(),
    coin_price: price && price > 0 ? price : null,
    active,
  };
  if (!fields.name) errorRedirect('/admin/catalogue', 'Give the item a name.');
  const { error } = id
    ? await supabase.from('catalogue_items').update(fields).eq('id', id)
    : await supabase.from('catalogue_items').insert({ ...fields, sort_order: 100 });
  if (error) errorRedirect('/admin/catalogue', error.message);
  revalidatePath('/admin/catalogue');
  revalidatePath('/coin');
}
