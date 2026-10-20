import { TASK_CATEGORY_LABELS } from '@/lib/constants';
import type { Profile, Task } from '@/lib/database.types';

// Form fields an admin fills in when creating or editing a task.
export function TaskFields({ members, task }: { members: Pick<Profile, 'id' | 'full_name' | 'email'>[]; task?: Task }) {
  const assignee = task ? (task.is_open && !task.assigned_to ? 'open' : task.assigned_to ?? '') : 'open';
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="title">Task title</label>
        <input className="input" id="title" name="title" required defaultValue={task?.title}
          placeholder="e.g. Make three reels for the new single" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="description">Details</label>
        <textarea className="input" id="description" name="description" rows={2} defaultValue={task?.description}
          placeholder="Any specifics, links, or context they need" />
      </div>
      <div>
        <label className="label" htmlFor="category">Category</label>
        <select className="input" id="category" name="category" defaultValue={task?.category ?? 'content'}>
          {Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="coin_value">LRR Coin for this task</label>
        <input className="input" id="coin_value" name="coin_value" type="number" min={0} step={1} required
          defaultValue={task?.coin_value ?? ''} placeholder="e.g. 25" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="assigned_to">Who does it</label>
        <select className="input" id="assigned_to" name="assigned_to" defaultValue={assignee}>
          <option value="open">Open — any approved member can claim it</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="week_of">Week of (optional)</label>
        <input className="input" id="week_of" name="week_of" type="date" defaultValue={task?.week_of ?? ''} />
      </div>
      <div>
        <label className="label" htmlFor="due_date">Deadline (optional)</label>
        <input className="input" id="due_date" name="due_date" type="date" defaultValue={task?.due_date ?? ''} />
      </div>
    </>
  );
}

export function CoinBadge({ value }: { value: number }) {
  if (!value) return null;
  return <span className="badge bg-orange-100 text-orange-700">{value} coin</span>;
}
