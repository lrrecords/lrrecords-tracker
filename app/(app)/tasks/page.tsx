import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/StatusBadge';
import { DueBadge } from '@/components/DueBadge';
import { CoinBadge, TaskFields } from '@/components/TaskFields';
import { TASK_CATEGORY_LABELS } from '@/lib/constants';
import { claimTask, createTask } from './actions';
import type { Profile, Task } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

type TaskRow = Task & { evidence: { count: number }[]; notes: { count: number }[] };

function TaskCard({ task, assigneeName }: { task: TaskRow; assigneeName?: string }) {
  return (
    <Link href={`/tasks/${task.id}`} className="card flex items-center justify-between gap-3 hover:border-orange-300">
      <div className="min-w-0">
        <p className="truncate font-semibold text-navy-900">{task.title}</p>
        <p className="truncate text-xs text-navy-500">
          {TASK_CATEGORY_LABELS[task.category]}
          {assigneeName ? ` · ${assigneeName}` : ''} · {task.evidence?.[0]?.count ?? 0} evidence ·{' '}
          {task.notes?.[0]?.count ?? 0} note(s)
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <CoinBadge value={task.coin_value} />
        <DueBadge dueDate={task.due_date} done={task.status === 'signed_off'} />
        <StatusBadge status={task.status} />
      </div>
    </Link>
  );
}

export default async function TasksPage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile) return null;
  const isAdmin = profile.role === 'admin';

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, evidence:task_evidence(count), notes:task_notes(count)')
    .order('created_at', { ascending: false })
    .returns<TaskRow[]>();

  const { data: members } = isAdmin
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('status', 'approved')
        .eq('role', 'member')
        .order('full_name')
        .returns<Pick<Profile, 'id' | 'full_name' | 'email'>[]>()
    : { data: [] as Pick<Profile, 'id' | 'full_name' | 'email'>[] };
  const names = new Map((members ?? []).map((m) => [m.id, m.full_name || m.email]));

  const all = tasks ?? [];
  const open = all.filter((t) => t.is_open && !t.assigned_to && t.status !== 'signed_off');
  const mine = all.filter((t) => !(t.is_open && !t.assigned_to));
  const active = mine.filter((t) => t.status !== 'signed_off');
  const done = mine.filter((t) => t.status === 'signed_off');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy-900">Tasks</h1>
        <p className="text-sm text-navy-500">
          {isAdmin
            ? 'Post tasks with a coin value, review evidence, and sign off completed work.'
            : 'Claim an open task, do the work, add your evidence. Coin lands when Brett signs it off.'}
        </p>
      </div>

      {searchParams.error && (
        <div className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">{searchParams.error}</div>
      )}

      {isAdmin && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-navy-800">+ Add a new task</summary>
          <form action={createTask} className="mt-4 grid gap-3 sm:grid-cols-2">
            <TaskFields members={members ?? []} />
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">Add task</button>
            </div>
          </form>
        </details>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-400">Open tasks</h2>
        {open.length === 0 ? (
          <div className="card text-sm text-navy-500">No open tasks right now. Check back soon.</div>
        ) : (
          <div className="space-y-2">
            {open.map((task) => (
              <div key={task.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/tasks/${task.id}`} className="font-semibold text-navy-900">
                    {task.title}
                  </Link>
                  <p className="text-xs text-navy-500">
                    {TASK_CATEGORY_LABELS[task.category]}
                    {task.description ? ` · ${task.description}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CoinBadge value={task.coin_value} />
                  <DueBadge dueDate={task.due_date} done={false} />
                  {!isAdmin && (
                    <form action={claimTask.bind(null, task.id)}>
                      <button className="btn-primary text-xs">Claim</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-400">
          {isAdmin ? 'In progress' : 'My tasks'}
        </h2>
        {active.length === 0 ? (
          <div className="card text-sm text-navy-500">
            {isAdmin ? 'Nothing assigned or claimed yet.' : 'You have no tasks yet — claim one above.'}
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((task) => (
              <TaskCard key={task.id} task={task} assigneeName={isAdmin ? names.get(task.assigned_to ?? '') : undefined} />
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-navy-400">
            Signed off ({done.length})
          </summary>
          <div className="mt-2 space-y-2">
            {done.map((task) => (
              <TaskCard key={task.id} task={task} assigneeName={isAdmin ? names.get(task.assigned_to ?? '') : undefined} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
