import { TASK_STATUS_LABELS } from '@/lib/constants';
import type { TaskStatus } from '@/lib/database.types';

const STYLES: Record<TaskStatus, string> = {
  pending: 'bg-navy-100 text-navy-600',
  in_progress: 'bg-orange-50 text-orange-700',
  submitted: 'bg-orange-100 text-orange-800',
  signed_off: 'bg-green-100 text-green-800',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{TASK_STATUS_LABELS[status]}</span>;
}
