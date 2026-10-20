import { getSessionProfile } from '@/lib/auth';
import { LEDGER_REASON_LABELS, REDEMPTION_STATUS_LABELS, formatDate } from '@/lib/constants';
import type { CatalogueItem, CoinLedgerRow, CoinSummary, Redemption } from '@/lib/database.types';
import { cancelRedemption, requestRedemption } from './actions';

export const dynamic = 'force-dynamic';

export default async function CoinPage({ searchParams }: { searchParams: { error?: string } }) {
  const { supabase, user, profile } = await getSessionProfile();

  const [{ data: summaryRows }, { data: ledger }, { data: items }, { data: requests }] = await Promise.all([
    supabase.rpc('coin_summary'),
    supabase
      .from('coin_ledger')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<CoinLedgerRow[]>(),
    supabase
      .from('catalogue_items')
      .select('*')
      .eq('active', true)
      .not('coin_price', 'is', null)
      .order('sort_order')
      .returns<CatalogueItem[]>(),
    supabase
      .from('redemptions')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .returns<Redemption[]>(),
  ]);

  const s = (summaryRows as CoinSummary[] | null)?.[0] ?? { balance: 0, held: 0, available: 0, next_expiry_amount: null, next_expiry_at: null };
  const soon = s.next_expiry_at && new Date(s.next_expiry_at).getTime() - Date.now() < 30 * 864e5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">LRR Coin</h1>
        <p className="text-sm text-navy-500">
          Earn coin for signed-off tasks and spend it on recording, mixing and mastering. Coin expires 12 months
          after you earn it.
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">{searchParams.error}</div>
      )}

      {profile.role === 'admin' ? (
        <div className="card text-sm text-navy-600">
          You&rsquo;re the admin, so you don&rsquo;t hold coin. Members&rsquo; balances, requests and prices are under{' '}
          <a href="/admin/members" className="font-semibold text-orange-600 hover:underline">Admin</a>.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card">
              <p className="label">Available</p>
              <p className="text-3xl font-bold text-navy-900">{s.available}</p>
              {s.held > 0 && <p className="text-xs text-navy-500">{s.held} held for pending requests</p>}
            </div>
            <div className={`card ${soon ? 'border-orange-300 bg-orange-50' : ''}`}>
              <p className="label">Next to expire</p>
              {s.next_expiry_amount ? (
                <>
                  <p className="text-3xl font-bold text-navy-900">{s.next_expiry_amount}</p>
                  <p className="text-xs text-navy-500">on {formatDate(s.next_expiry_at)}</p>
                </>
              ) : (
                <p className="text-sm text-navy-500">Nothing due to expire</p>
              )}
            </div>
            <div className="card">
              <p className="label">Total balance</p>
              <p className="text-3xl font-bold text-navy-900">{s.balance}</p>
            </div>
          </div>

          <div className="card">
            <h2 className="mb-3 text-sm font-bold text-navy-900">Spend your coin</h2>
            {(items ?? []).length === 0 ? (
              <p className="text-sm text-navy-500">Studio prices are being set — check back soon.</p>
            ) : (
              <div className="space-y-3">
                {(items ?? []).map((item) => (
                  <form
                    key={item.id}
                    action={requestRedemption.bind(null, item.id)}
                    className="flex flex-wrap items-end gap-3 rounded-md border border-navy-100 p-3"
                  >
                    <div className="min-w-[10rem] flex-1">
                      <p className="font-semibold text-navy-900">{item.name}</p>
                      <p className="text-xs text-navy-500">
                        {item.coin_price} coin per {item.unit}
                        {item.description ? ` · ${item.description}` : ''}
                      </p>
                    </div>
                    <div className="w-20">
                      <label className="label" htmlFor={`q-${item.id}`}>{item.unit}s</label>
                      <input className="input" id={`q-${item.id}`} name="quantity" type="number" min={1} max={50} defaultValue={1} />
                    </div>
                    <input className="input min-w-[10rem] flex-1" name="notes" placeholder="Song, dates that suit you…" />
                    <button className="btn-primary">Request</button>
                  </form>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-navy-500">
              Requests hold the coin until Brett approves them and books the session with you.
            </p>
          </div>

          {(requests ?? []).length > 0 && (
            <div className="card">
              <h2 className="mb-3 text-sm font-bold text-navy-900">Your requests</h2>
              <div className="space-y-2">
                {(requests ?? []).map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-navy-50 p-2 text-sm">
                    <div>
                      <p className="font-medium text-navy-800">
                        {r.item_name} × {r.quantity} — {r.coin_total} coin
                      </p>
                      <p className="text-xs text-navy-500">
                        {formatDate(r.created_at)} · {REDEMPTION_STATUS_LABELS[r.status]}
                        {r.admin_note ? ` · ${r.admin_note}` : ''}
                      </p>
                    </div>
                    {r.status === 'requested' && (
                      <form action={cancelRedemption.bind(null, r.id)}>
                        <button className="btn-ghost text-xs">Cancel</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="mb-3 text-sm font-bold text-navy-900">History</h2>
            {(ledger ?? []).length === 0 ? (
              <p className="text-sm text-navy-500">No coin yet. Claim a task to start earning.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {(ledger ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-navy-100">
                      <td className="py-2 pr-2 text-xs text-navy-500">{formatDate(row.created_at)}</td>
                      <td className="py-2 pr-2">
                        <span className="text-navy-800">{LEDGER_REASON_LABELS[row.reason]}</span>
                        {row.note && <span className="text-navy-500"> · {row.note}</span>}
                        {row.expires_at && row.amount > 0 && (
                          <span className="block text-xs text-navy-400">expires {formatDate(row.expires_at)}</span>
                        )}
                      </td>
                      <td className={`py-2 text-right font-semibold ${row.amount > 0 ? 'text-green-700' : 'text-navy-700'}`}>
                        {row.amount > 0 ? `+${row.amount}` : row.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
