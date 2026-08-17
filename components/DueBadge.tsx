function isOverdue(dueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

export function DueBadge({ dueDate, done }: { dueDate: string | null; done: boolean }) {
  if (!dueDate) return null;
  const overdue = !done && isOverdue(dueDate);
  const formatted = new Date(dueDate).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
  return (
    <span className={`badge ${overdue ? 'bg-red-100 text-red-700' : 'bg-navy-50 text-navy-500'}`}>
      {overdue ? 'Overdue — ' : 'Due '}
      {formatted}
    </span>
  );
}
