import { createClient } from '@/lib/supabase/server';
import { ProgressBar } from '@/components/ProgressBar';
import { SONG_STATUS_LABELS } from '@/lib/constants';
import type { Profile, Settings, Song, StudioTimeEntry, StudioUnlock } from '@/lib/database.types';
import { addSong, addTimeEntry, deleteTimeEntry, markUnlockUsed, updateSongStatus } from './actions';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile) return null;

  const [{ data: settings }, { count: signedOffCount }, { data: unlocks }, { data: songs }, { data: entries }, names] =
    await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).single<Settings>(),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'signed_off'),
      supabase.from('studio_unlocks').select('*').order('earned_at', { ascending: false }).returns<StudioUnlock[]>(),
      supabase.from('songs').select('*').order('created_at', { ascending: false }).returns<Song[]>(),
      supabase
        .from('studio_time_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .returns<StudioTimeEntry[]>(),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .then(({ data }) => new Map((data ?? []).map((p) => [p.id, p.full_name || p.email]))),
    ]);

  const threshold = settings?.tasks_required_for_studio ?? 4;
  const done = signedOffCount ?? 0;
  const progressWithinCycle = done % threshold;

  const availableUnlocks = (unlocks ?? []).filter((u) => u.status === 'available');
  const usedUnlocks = (unlocks ?? []).filter((u) => u.status === 'used');

  const entriesBySong = new Map<string, StudioTimeEntry[]>();
  const generalEntries: StudioTimeEntry[] = [];
  for (const e of entries ?? []) {
    if (e.song_id) {
      if (!entriesBySong.has(e.song_id)) entriesBySong.set(e.song_id, []);
      entriesBySong.get(e.song_id)!.push(e);
    } else {
      generalEntries.push(e);
    }
  }

  const totalHours = (entries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Studio</h1>
        <p className="text-sm text-navy-500">Studio time unlocks and per-song production log — {totalHours}h logged in total.</p>
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-bold text-navy-900">Studio time progress</h2>
        <ProgressBar value={progressWithinCycle} max={threshold} />

        {availableUnlocks.length > 0 && (
          <div className="mt-4 space-y-2">
            {availableUnlocks.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 rounded-md bg-orange-50 p-3">
                <div>
                  <p className="text-sm font-semibold text-orange-800">
                    🎧 {u.hours}h studio session unlocked!
                  </p>
                  <p className="text-xs text-orange-700">
                    Earned after {u.tasks_completed_count} signed-off tasks · {new Date(u.earned_at).toLocaleDateString('en-AU')}
                  </p>
                </div>
                {profile.role === 'admin' && (
                  <form action={markUnlockUsed.bind(null, u.id)} className="flex items-center gap-2">
                    <input type="text" name="notes" placeholder="Session notes (optional)" className="input w-40 text-xs" />
                    <button className="btn-secondary text-xs">Mark used</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        {usedUnlocks.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-navy-500">
              {usedUnlocks.length} past session(s) used
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-navy-500">
              {usedUnlocks.map((u) => (
                <li key={u.id}>
                  {u.hours}h — used {u.used_at ? new Date(u.used_at).toLocaleDateString('en-AU') : ''}
                  {u.notes ? ` — ${u.notes}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Songs</h2>

        <details className="mb-4">
          <summary className="cursor-pointer text-sm font-semibold text-navy-800">+ Add a song</summary>
          <form action={addSong} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className="input sm:col-span-2" name="title" placeholder="Song title" required />
            <select className="input" name="status" defaultValue="idea">
              {Object.entries(SONG_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input className="input" name="notes" placeholder="Notes (optional)" />
            <button type="submit" className="btn-primary sm:col-span-2">Add song</button>
          </form>
        </details>

        <div className="space-y-3">
          {(songs ?? []).length === 0 && <p className="text-sm text-navy-500">No songs added yet.</p>}
          {(songs ?? []).map((song) => {
            const songEntries = entriesBySong.get(song.id) ?? [];
            const songHours = songEntries.reduce((sum, e) => sum + Number(e.hours), 0);
            return (
              <details key={song.id} className="rounded-md border border-navy-100 p-3">
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="font-semibold text-navy-900">{song.title}</span>
                  <span className="flex items-center gap-2 text-xs text-navy-500">
                    <span className="badge bg-navy-100 text-navy-600">{SONG_STATUS_LABELS[song.status]}</span>
                    {songHours}h logged
                  </span>
                </summary>

                <div className="mt-3 space-y-3">
                  <form action={updateSongStatus.bind(null, song.id)} className="flex items-center gap-2">
                    <select className="input w-auto text-xs" name="status" defaultValue={song.status}>
                      {Object.entries(SONG_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <button className="btn-ghost text-xs">Update status</button>
                  </form>

                  <div className="space-y-2">
                    {songEntries.map((e) => (
                      <div key={e.id} className="flex items-start justify-between gap-2 rounded bg-navy-50 p-2 text-xs">
                        <div>
                          <p className="font-medium text-navy-800">
                            {e.task_description} — {e.hours}h
                          </p>
                          <p className="text-navy-500">
                            {new Date(e.entry_date).toLocaleDateString('en-AU')} · {names.get(e.logged_by ?? '') ?? 'Unknown'}
                            {e.notes ? ` — ${e.notes}` : ''}
                          </p>
                        </div>
                        <form action={deleteTimeEntry.bind(null, e.id)}>
                          <button className="text-red-500 hover:underline">Remove</button>
                        </form>
                      </div>
                    ))}
                  </div>

                  <form action={addTimeEntry.bind(null, song.id)} className="grid gap-2 border-t border-navy-100 pt-3 sm:grid-cols-2">
                    <input className="input sm:col-span-2" name="task_description" placeholder="What did you work on?" required />
                    <input className="input" name="hours" type="number" min="0" step="0.25" placeholder="Hours" required />
                    <input className="input" name="entry_date" type="date" />
                    <input className="input sm:col-span-2" name="notes" placeholder="Notes (optional)" />
                    <button type="submit" className="btn-secondary sm:col-span-2">Log time</button>
                  </form>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">General studio time (not tied to a song)</h2>
        <div className="space-y-2">
          {generalEntries.length === 0 && <p className="text-sm text-navy-500">Nothing logged yet.</p>}
          {generalEntries.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2 rounded bg-navy-50 p-2 text-xs">
              <div>
                <p className="font-medium text-navy-800">{e.task_description} — {e.hours}h</p>
                <p className="text-navy-500">
                  {new Date(e.entry_date).toLocaleDateString('en-AU')} · {names.get(e.logged_by ?? '') ?? 'Unknown'}
                  {e.notes ? ` — ${e.notes}` : ''}
                </p>
              </div>
              <form action={deleteTimeEntry.bind(null, e.id)}>
                <button className="text-red-500 hover:underline">Remove</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addTimeEntry.bind(null, null)} className="mt-3 grid gap-2 border-t border-navy-100 pt-3 sm:grid-cols-2">
          <input className="input sm:col-span-2" name="task_description" placeholder="What did you work on?" required />
          <input className="input" name="hours" type="number" min="0" step="0.25" placeholder="Hours" required />
          <input className="input" name="entry_date" type="date" />
          <input className="input sm:col-span-2" name="notes" placeholder="Notes (optional)" />
          <button type="submit" className="btn-secondary sm:col-span-2">Log time</button>
        </form>
      </div>
    </div>
  );
}
