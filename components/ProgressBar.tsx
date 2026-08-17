export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-navy-100">
        <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-navy-500">
        {value} / {max} tasks toward the next studio session
      </p>
    </div>
  );
}
