import { requireAdmin } from '@/lib/auth';
import type { CatalogueItem } from '@/lib/database.types';
import { saveCatalogueItem } from '../actions';

export const dynamic = 'force-dynamic';

const KINDS = ['recording', 'mixing', 'mastering', 'digital', 'merch', 'distribution', 'other'];

function ItemFields({ item }: { item?: CatalogueItem }) {
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label">Name</label>
        <input className="input" name="name" required defaultValue={item?.name} />
      </div>
      <div>
        <label className="label">Type</label>
        <select className="input" name="kind" defaultValue={item?.kind ?? 'other'}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Unit</label>
        <input className="input" name="unit" defaultValue={item?.unit ?? 'each'} placeholder="hour, song, each" />
      </div>
      <div>
        <label className="label">Coin price per unit</label>
        <input className="input" name="coin_price" type="number" min={1} step={1} defaultValue={item?.coin_price ?? ''} />
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input type="checkbox" name="active" defaultChecked={item?.active} className="accent-orange-500" />
          Show to members
        </label>
      </div>
      <div className="sm:col-span-2">
        <label className="label">Description</label>
        <input className="input" name="description" defaultValue={item?.description} />
      </div>
    </>
  );
}

export default async function CataloguePage({ searchParams }: { searchParams: { error?: string } }) {
  const { supabase } = await requireAdmin();
  const { data: items } = await supabase.from('catalogue_items').select('*').order('sort_order').returns<CatalogueItem[]>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Prices</h1>
        <p className="text-sm text-navy-500">
          What members can spend coin on. Items stay hidden until they have a price and “Show to members” is ticked.
        </p>
      </div>
      {searchParams.error && (
        <div className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">{searchParams.error}</div>
      )}
      {(items ?? []).map((item) => (
        <form key={item.id} action={saveCatalogueItem.bind(null, item.id)} className="card grid gap-3 sm:grid-cols-2">
          <ItemFields item={item} />
          <div className="sm:col-span-2 flex items-center justify-between">
            <span className="text-xs text-navy-500">
              {item.active && item.coin_price ? 'Visible to members' : 'Hidden from members'}
            </span>
            <button className="btn-secondary">Save</button>
          </div>
        </form>
      ))}
      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-navy-800">+ Add an item</summary>
        <form action={saveCatalogueItem.bind(null, null)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <ItemFields />
          <div className="sm:col-span-2">
            <button className="btn-primary">Add item</button>
          </div>
        </form>
      </details>
    </div>
  );
}
