import { requireAdmin } from '@/lib/auth';
import { REDEMPTION_STATUS_LABELS, formatDate } from '@/lib/constants';
import type { Profile, Redemption } from '@/lib/database.types';
import { completeRedemption, decideRedemption } from '../actions';

export const dynamic = 'force-dynamic';

export default async function RequestsPage({ searchParams }: { searchParams: { error?: string } }) {
  const { supabase } = await requireAdmin();
  const [{ data: requests }, { data: people }] = await Promise.all([
    supabase.from('redemptions').select('*').order('created_at', { ascending: false }).limit(200).returns<Redemption[]>(),
    supabase.from('profiles').select('id, full_name, email').returns<Pick<Profile, 'id' | 'full_name' | 'email'>[]>(),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));
  const all = requests ?? [];
  const waiting = all.filter((r) => r.status === 'requested');
  const toBook = all.filter((r) => r.status === 'approved');
  const past = all.filter((r) => !['requested', 'approved'].includes(r.status));

  const line = (r: Redemption) => (
    <div>
      <p className="font-medium text-navy-900">
        {names.get(r.profile_id) ?? 'Unknown'} — {r.item_name} × {r.quantity} ({r.coin_total} coin)
      </p>
      <p className="text-xs text-navy-500">
        {formatDate(r.created_at)}
        {r.notes ? ` · “${r.notes}”` : ''}
        {r.admin_note ? ` · your note: ${r.admin_note}` : ''}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Coin requests</h1>
        <p className="text-sm text-navy-500">
          Approving takes the coin from the member’s balance. Then book the session with them and mark it done.
        </p>
      </div>
      {searchParams.error && (
        <div className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">{searchParams.error}</div>
      )}

      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Waiting for you ({waiting.length})</h2>
        {waiting.length === 0 && <p className="text-sm text-navy-500">Nothing waiting.</p>}
        <div className="space-y-3">
          {waiting.map((r) => (
            <div key={r.id} className="space-y-2 rounded-md border border-navy-100 p-3">
              {line(r)}
              <form className="flex flex-wrap items-center gap-2">
                <input className="input min-w-[12rem] flex-1" name="admin_note" placeholder="Note to member (optional)" />
                <button formAction={decideRedemption.bind(null, r.id, true)} className="btn-primary text-xs">Approve</button>
                <button formAction={decideRedemption.bind(null, r.id, false)} className="btn-ghost text-xs">Decline</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Approved — to book ({toBook.length})</h2>
        {toBook.length === 0 && <p className="text-sm text-navy-500">Nothing to book.</p>}
        <div className="space-y-2">
          {toBook.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-navy-50 p-2 text-sm">
              {line(r)}
              <form action={completeRedemption.bind(null, r.id)}>
                <button className="btn-secondary text-xs">Mark done</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {past.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-bold text-navy-900">History ({past.length})</summary>
          <div className="mt-3 space-y-2 text-sm">
            {past.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                {line(r)}
                <span className="badge bg-navy-100 text-navy-600">{REDEMPTION_STATUS_LABELS[r.status]}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
