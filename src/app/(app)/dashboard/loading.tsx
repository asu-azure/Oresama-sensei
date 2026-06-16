// Instant fallback for the Progress tab while stats are aggregated server-side.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6 py-4">
      <div className="h-6 w-32 rounded-lg bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-44 rounded-2xl bg-surface-2" />
        <div className="h-44 rounded-2xl bg-surface-2" />
      </div>
      <div className="h-48 rounded-2xl bg-surface-2" />
    </div>
  );
}
