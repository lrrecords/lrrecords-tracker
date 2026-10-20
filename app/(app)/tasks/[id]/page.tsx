import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/StatusBadge';
import { DueBadge } from '@/components/DueBadge';
import { EVIDENCE_TYPE_LABELS, TASK_CATEGORY_LABELS } from '@/lib/constants';
import { CoinBadge, TaskFields } from '@/components/TaskFields';
import type { Profile, Task, TaskEvidence, TaskNote } from '@/lib/database.types';
import {
  addEvidence,
  addNote,
  claimTask,
  deleteEvidence,
  deleteTask,
  toggleSignOff,
  updateTaskDetails,
  updateTaskStatus,
} from '../actions';

export const dynamic = 'force-dynamic';

async function getNameMap(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.from('profiles').select('id, full_name, email');
  const map = new Map<string, string>();
  for (const p of data ?? []) map.set(p.id, p.full_name || p.email);
  return map;
}

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile) return null;

  const { data: task } = await supabase.from('tasks').select('*').eq('id', params.id).single<Task>();
  if (!task) notFound();

  const [{ data: evidence }, { data: notes }, names] = await Promise.all([
    supabase
      .from('task_evidence')
      .select('*')
      .eq('task_id', params.id)
      .order('created_at', { ascending: true })
      .returns<TaskEvidence[]>(),
    supabase
      .from('task_notes')
      .select('*')
      .eq('task_id', params.id)
      .order('created_at', { ascending: true })
      .returns<TaskNote[]>(),
    getNameMap(supabase),
  ]);

  const evidenceWithUrls = await Promise.all(
    (evidence ?? []).map(async (item) => {
      if (!item.file_path) return { ...item, url: null as string | null };
      const { data } = await supabase.storage.from('evidence').createSignedUrl(item.file_path, 60 * 60);
      return { ...item, url: data?.signedUrl ?? null };
    })
  );

  const isAdmin = profile.role === 'admin';
  const signedOff = task.status === 'signed_off';
  const unclaimed = task.is_open && !task.assigned_to;
  const isMine = task.assigned_to === user.id;

  const { data: members } = isAdmin
    ? await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('status', 'approved')
        .eq('role', 'member')
        .order('full_name')
        .returns<Pick<Profile, 'id' | 'full_name' | 'email'>[]>()
    : { data: [] as Pick<Profile, 'id' | 'full_name' | 'email'>[] };

  const updateDetails = updateTaskDetails.bind(null, task.id);
  const addEv = addEvidence.bind(null, task.id);
  const addN = addNote.bind(null, task.id);
  const startTask = updateTaskStatus.bind(null, task.id, 'in_progress');
  const submitTask = updateTaskStatus.bind(null, task.id, 'submitted');
  const reopenTask = updateTaskStatus.bind(null, task.id, 'pending');
  const signOff = toggleSignOff.bind(null, task.id, true);
  const unsignOff = toggleSignOff.bind(null, task.id, false);
  const removeTask = deleteTask.bind(null, task.id);

  return (
    <div className="space-y-6">
      <a href="/tasks" className="text-sm text-navy-500 hover:text-orange-600">&larr; Back to tasks</a>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-navy-900">{task.title}</h1>
            <p className="mt-0.5 text-xs text-navy-500">
              {TASK_CATEGORY_LABELS[task.category]}
              {isAdmin && ` · ${unclaimed ? 'Open to claim' : names.get(task.assigned_to ?? '') ?? 'Unassigned'}`}
            </p>
            {task.description && <p className="mt-1 text-sm text-navy-600">{task.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <CoinBadge value={task.coin_value} />
            <DueBadge dueDate={task.due_date} done={signedOff} />
            <StatusBadge status={task.status} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!isAdmin && unclaimed && (
            <form action={claimTask.bind(null, task.id)}><button className="btn-primary">Claim this task</button></form>
          )}
          {!isAdmin && isMine && task.status === 'pending' && (
            <form action={startTask}><button className="btn-secondary">Start task</button></form>
          )}
          {!isAdmin && isMine && (task.status === 'pending' || task.status === 'in_progress') && (
            <form action={submitTask}><button className="btn-primary">Submit for review</button></form>
          )}
          {!isAdmin && isMine && task.status === 'submitted' && (
            <p className="text-sm text-navy-500">Submitted — waiting on Brett to review and sign off. Your coin lands when it’s signed off.</p>
          )}

          {isAdmin && !signedOff && (
            <form action={signOff}><button className="btn-primary">✓ Sign off this task</button></form>
          )}
          {isAdmin && signedOff && (
            <form action={unsignOff}><button className="btn-ghost">Undo sign-off</button></form>
          )}
          {isAdmin && task.status !== 'pending' && !signedOff && (
            <form action={reopenTask}><button className="btn-ghost">Reset to To Do</button></form>
          )}
          {isAdmin && (
            <form action={removeTask}>
              <button className="btn-ghost text-red-600 hover:bg-red-50">Delete task</button>
            </form>
          )}
        </div>
      </div>

      {isAdmin && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-navy-800">Edit task details</summary>
          <form action={updateDetails} className="mt-4 grid gap-3 sm:grid-cols-2">
            <TaskFields members={members ?? []} task={task} />
            <div className="sm:col-span-2">
              <button type="submit" className="btn-secondary">Save changes</button>
            </div>
          </form>
        </details>
      )}

      {(isAdmin || isMine) && (<>
      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Evidence</h2>

        <div className="space-y-3">
          {evidenceWithUrls.length === 0 && (
            <p className="text-sm text-navy-500">No evidence submitted yet.</p>
          )}
          {evidenceWithUrls.map((item) => (
            <div key={item.id} className="rounded-md border border-navy-100 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="badge bg-navy-100 text-navy-600">{EVIDENCE_TYPE_LABELS[item.type]}</span>
                <span className="text-xs text-navy-400">
                  {names.get(item.created_by ?? '') ?? 'Unknown'} ·{' '}
                  {new Date(item.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {item.type === 'link' && item.content && (
                <a href={item.content} target="_blank" rel="noreferrer" className="break-all text-sm text-orange-600 hover:underline">
                  {item.content}
                </a>
              )}
              {item.type === 'text' && item.content && <p className="whitespace-pre-wrap text-sm text-navy-700">{item.content}</p>}
              {(item.type === 'file' || item.type === 'screenshot') && (
                <div className="text-sm">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="font-medium text-orange-600 hover:underline">
                      View / download file
                    </a>
                  ) : (
                    <span className="text-navy-400">File unavailable</span>
                  )}
                  {item.content && <p className="mt-1 text-navy-600">{item.content}</p>}
                </div>
              )}
              {(isAdmin || item.created_by === user.id) && (
                <form action={deleteEvidence.bind(null, task.id, item.id, item.file_path)} className="mt-2">
                  <button className="text-xs text-red-500 hover:underline">Remove</button>
                </form>
              )}
            </div>
          ))}
        </div>

        <form action={addEv} className="mt-4 space-y-2 border-t border-navy-100 pt-4">
          <label className="label" htmlFor="type">Add evidence</label>
          <select className="input" id="type" name="type" defaultValue="text">
            <option value="text">Text note</option>
            <option value="link">Link (Drive, YouTube, message, etc.)</option>
            <option value="file">File upload</option>
            <option value="screenshot">Screenshot upload</option>
          </select>
          <textarea className="input" name="content" rows={2} placeholder="Notes, a URL, or a caption for your file" />
          <input className="input" name="file" type="file" accept="image/*,application/pdf,audio/*,video/*" />
          <button type="submit" className="btn-primary">Add evidence</button>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-navy-900">Notes &amp; feedback</h2>
        <div className="space-y-3">
          {(notes ?? []).length === 0 && <p className="text-sm text-navy-500">No notes yet.</p>}
          {(notes ?? []).map((n) => (
            <div key={n.id} className="rounded-md bg-navy-50 p-3 text-sm">
              <div className="mb-1 text-xs font-semibold text-navy-500">
                {names.get(n.author_id ?? '') ?? 'Unknown'} ·{' '}
                {new Date(n.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
              <p className="whitespace-pre-wrap text-navy-700">{n.note}</p>
            </div>
          ))}
        </div>
        <form action={addN} className="mt-4 space-y-2 border-t border-navy-100 pt-4">
          <textarea className="input" name="note" rows={2} placeholder="Leave a note or feedback for the other person" required />
          <button type="submit" className="btn-secondary">Post note</button>
        </form>
      </div>
      </>)}
    </div>
  );
}
