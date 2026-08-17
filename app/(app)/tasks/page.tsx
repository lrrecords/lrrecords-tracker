import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/StatusBadge';
import { DueBadge } from '@/components/DueBadge';
import { createTask } from './actions';
import type { Profile, Task } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

type TaskRow = Task & { evidence: { count: number }[]; notes: { count: number }[] };

export default async function TasksPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile) return null;

  const query = supabase
    .from('tasks')
    .select('*, evidence:task_evidence(count), notes:task_notes(count)')
    .order('week_of', { ascending: false, nullsFirst: false })
    .order('sort_order', { ascending: true });

  if (profile.role === 'student') {
    query.eq('assigned_to', user.id);
  }

  const { data: tasks } = await query.returns<TaskRow[]>();

  const grouped = new Map<string, TaskRow[]>();
  for (const task of tasks ?? []) {
    const key = task.week_of ?? 'No week set';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(task);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Friday Tasks</h1>
        <p className="text-sm text-navy-500">
          {profile.role === 'admin'
            ? 'Set the list, review evidence, and sign off completed work.'
            : 'Work through this week’s list, tick things off, and add your evidence.'}
        </p>
      </div>

      {profile.role === 'admin' && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-navy-800">+ Add a new task</summary>
          <form action={createTask} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="title">Task title</label>
              <input className="input" id="title" name="title" required placeholder="e.g. Log and label last week's session files" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">Details</label>
              <textarea className="input" id="description" name="description" rows={2} placeholder="Any specifics, links, or context Alec needs" />
            </div>
            <div>
              <label className="label" htmlFor="week_of">Week of (Friday)</label>
              <input className="input" id="week_of" name="week_of" type="date" />
            </div>
            <div>
              <label className="label" htmlFor="due_date">Deadline</label>
              <input className="input" id="due_date" name="due_date" type="date" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">Add task</button>
            </div>
          </form>
        </details>
      )}

      {grouped.size === 0 && (
        <div className="card text-center text-sm text-navy-500">
          No tasks yet{profile.role === 'admin' ? ' — add the first one above.' : ' — check back once Brett sets the list.'}
        </div>
      )}

      {Array.from(grouped.entries()).map(([week, weekTasks]) => (
        <div key={week}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-400">
            {week === 'No week set' ? week : `Week of ${new Date(week).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </h2>
          <div className="space-y-2">
            {weekTasks.map((task) => (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="card flex items-center justify-between gap-3 hover:border-orange-300"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-navy-900">{task.title}</p>
                  <p className="truncate text-xs text-navy-500">
                    {task.evidence?.[0]?.count ?? 0} evidence item(s) · {task.notes?.[0]?.count ?? 0} note(s)
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <DueBadge dueDate={task.due_date} done={task.status === 'signed_off'} />
                  <StatusBadge status={task.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
