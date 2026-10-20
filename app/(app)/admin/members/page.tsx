import { requireAdmin } from '@/lib/auth';
import { TASK_CATEGORY_LABELS, formatDate } from '@/lib/constants';
import type { CoinSummary, Profile, StudioUnlock } from '@/lib/database.types';
import { adjustCoin, setMemberRole, setMemberStatus } from '../actions';

export const dynamic = 'force-dynamic';

function Answers({ p }: { p: Profile }) {
  return (
    <dl className="mt-2 grid gap-1 text-xs text-navy-600 sm:grid-cols-[10rem_1fr]">
      <dt className="font-semibold text-navy-500">Tasks they’d do</dt>
      <dd>{p.task_interests.length ? p.task_interests.map((t) => TASK_CATEGORY_LABELS[t] ?? t).join(', ') : '—'}</dd>
      <dt className="font-semibold text-navy-500">Time per week</dt>
      <dd>{p.weekly_hours || '—'}</dd>
      <dt className="font-semibold text-navy-500">With LRRecords before</dt>
      <dd>{p.relationship || '—'}</dd>
      {p.application_note && (
        <>
          <dt className="font-semibold text-navy-500">Note</dt>
          <dd className="whitespace-pre-wrap">{p.application_note}</dd>
        </>
      )}
    </dl>
  );
}

export default async function MembersPage({ searchParams }: { searchParams: { error?: string } }) {
  const { supabase, user } = await requireAdmin();

  const [{ data: people }, { data: tasks }, { data: unlocks }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at').returns<Profile[]>(),
    supabase.from('tasks').select('assigned_to').eq('status', 'signed_off').returns<{ assigned_to: string | null }[]>(),
    supabase.from('studio_unlocks').select('*').eq('status', 'available').returns<StudioUnlock[]>(),
  ]);

  const all = people ?? [];
  const pending = all.filter((p) => p.status === 'pending' && p.role !== 'admin');
  const members = all.filter((p) => p.role === 'member' && p.status !== 'pending');
  const admins = all.filter((p) => p.role === 'admin');

  const summaries = new Map<string, CoinSummary>();
  await Promise.all(
    members.map(async (m) => {
      const { data } = await supabase.rpc('coin_summary', { p_profile: m.id });
      const row = (data as CoinSummary[] | null)?.[0];
      if (row) summaries.set(m.id, row);
    })
  );
  const signedOff = new Map<string, number>();
  for (const t of tasks ?? []) if (t.assigned_to) signedOff.set(t.assigned_to, (signedOff.get(t.assigned_to) ?? 0) + 1);
  const unusedHours = (unlocks ?? []).reduce((sum, u) => sum + Number(u.hours), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Members</h1>
        <p className="text-sm text-navy-500">Review applications, manage members and adjust coin balances.</p>
      </div>

      {searchParams.error && (
        <div className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">{searchParams.error}</div>
      )}

      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Applications ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-navy-500">No applications waiting.</p>}
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.id} className="rounded-md border border-navy-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-navy-900">{p.full_name || p.email}</p>
                  <p className="text-xs text-navy-500">{p.email} · applied {formatDate(p.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <form action={setMemberStatus.bind(null, p.id, 'approved')}>
                    <button className="btn-primary text-xs">Approve</button>
                  </form>
                  <form action={setMemberStatus.bind(null, p.id, 'declined')}>
                    <button className="btn-ghost text-xs">Decline</button>
                  </form>
                </div>
              </div>
              <Answers p={p} />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Members ({members.length})</h2>
        {unusedHours > 0 && (
          <p className="mb-3 rounded-md bg-orange-50 p-2 text-xs text-orange-800">
            From the old system: {unusedHours} hours of earned studio time were never used. Add them as an
            opening balance below (e.g. hours × your recording-hour coin price), noting “Opening balance”.
          </p>
        )}
        {members.length === 0 && <p className="text-sm text-navy-500">No members yet.</p>}
        <div className="space-y-3">
          {members.map((m) => {
            const s = summaries.get(m.id);
            return (
              <details key={m.id} className="rounded-md border border-navy-100 p-3">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold text-navy-900">{m.full_name || m.email}</span>
                    {m.status !== 'approved' && (
                      <span className="badge ml-2 bg-navy-100 text-navy-600">{m.status}</span>
                    )}
                  </span>
                  <span className="text-xs text-navy-500">
                    {s?.balance ?? 0} coin · {signedOff.get(m.id) ?? 0} tasks signed off
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                  <Answers p={m} />
                  {s?.next_expiry_amount ? (
                    <p className="text-xs text-navy-500">
                      {s.next_expiry_amount} coin expires {formatDate(s.next_expiry_at)}
                      {s.held ? ` · ${s.held} held for requests` : ''}
                    </p>
                  ) : null}
                  <form action={adjustCoin.bind(null, m.id)} className="flex flex-wrap items-end gap-2 border-t border-navy-100 pt-3">
                    <div className="w-28">
                      <label className="label" htmlFor={`amt-${m.id}`}>Coin +/−</label>
                      <input className="input" id={`amt-${m.id}`} name="amount" type="number" step={1} required />
                    </div>
                    <div className="min-w-[12rem] flex-1">
                      <label className="label" htmlFor={`note-${m.id}`}>Reason</label>
                      <input className="input" id={`note-${m.id}`} name="note" required placeholder="e.g. Opening balance" />
                    </div>
                    <button className="btn-secondary">Adjust</button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {m.status === 'approved' ? (
                      <form action={setMemberStatus.bind(null, m.id, 'suspended')}>
                        <button className="btn-ghost text-xs">Suspend</button>
                      </form>
                    ) : (
                      <form action={setMemberStatus.bind(null, m.id, 'approved')}>
                        <button className="btn-ghost text-xs">Reactivate</button>
                      </form>
                    )}
                    <form action={setMemberRole.bind(null, m.id, 'admin')}>
                      <button className="btn-ghost text-xs">Make admin</button>
                    </form>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Admins</h2>
        <div className="space-y-2">
          {admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-navy-700">{a.full_name || a.email}</span>
              {a.id !== user.id && (
                <form action={setMemberRole.bind(null, a.id, 'member')}>
                  <button className="btn-ghost text-xs">Make member</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
