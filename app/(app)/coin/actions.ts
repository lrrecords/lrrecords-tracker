'use server';

import { revalidatePath } from 'next/cache';
import { errorRedirect, requireApproved } from '@/lib/auth';

export async function requestRedemption(itemId: string, formData: FormData) {
  const { supabase } = await requireApproved();
  const { error } = await supabase.rpc('request_redemption', {
    p_item: itemId,
    p_quantity: Math.round(Number(formData.get('quantity') || 1)),
    p_notes: String(formData.get('notes') || '').trim(),
  });
  if (error) errorRedirect('/coin', error.message);
  revalidatePath('/coin');
}

export async function cancelRedemption(id: string) {
  const { supabase } = await requireApproved();
  const { error } = await supabase.rpc('cancel_redemption', { p_id: id });
  if (error) errorRedirect('/coin', error.message);
  revalidatePath('/coin');
}
