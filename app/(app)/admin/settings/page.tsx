import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Settings } from '@/lib/database.types';
import { updateProfileRole, updateSettings } from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile || profile.role !== 'admin') redirect('/tasks');

  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single<Settings>();
  const { data: people } = await supabase.from('profiles').select('*').order('created_at').returns<Profile[]>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Settings</h1>
        <p className="text-sm text-navy-500">Configure how many signed-off tasks unlock a studio session.</p>
      </div>

      <div className="card max-w-md">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Studio unlock rule</h2>
        <form action={updateSettings} className="space-y-3">
          <div>
            <label className="label" htmlFor="tasks_required_for_studio">Tasks required per unlock</label>
            <input
              className="input"
              id="tasks_required_for_studio"
              name="tasks_required_for_studio"
              type="number"
              min={1}
              defaultValue={settings?.tasks_required_for_studio ?? 4}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="studio_hours_per_unlock">Studio hours awarded per unlock</label>
            <input
              className="input"
              id="studio_hours_per_unlock"
              name="studio_hours_per_unlock"
              type="number"
              min={0}
              step="0.5"
              defaultValue={settings?.studio_hours_per_unlock ?? 2}
              required
            />
          </div>
          <button type="submit" className="btn-primary">Save</button>
        </form>
        <p className="mt-3 text-xs text-navy-500">
          Every time the total number of signed-off tasks crosses a multiple of this number, a new
          studio session automatically appears as "available" on the Studio tab.
        </p>
      </div>

      <div className="card max-w-md">
        <h2 className="mb-3 text-sm font-bold text-navy-900">People</h2>
        <div className="space-y-2">
          {(people ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-navy-700">{p.full_name || p.email}</span>
              <form action={updateProfileRole.bind(null, p.id, p.role === 'admin' ? 'student' : 'admin')}>
                <button className="btn-ghost text-xs">
                  {p.role === 'admin' ? 'Admin — make student' : 'Student — make admin'}
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
