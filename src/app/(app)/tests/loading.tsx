export default function TestsLoading() {
  return (
    <div className="animate-pulse space-y-5 py-4">
      <div className="h-7 w-28 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-10 w-40 rounded-xl bg-surface-2" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
