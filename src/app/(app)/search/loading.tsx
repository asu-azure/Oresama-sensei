export default function SearchLoading() {
  return (
    <div className="animate-pulse space-y-5 py-4">
      <div className="h-7 w-32 rounded-lg bg-surface-2" />
      <div className="h-11 w-full rounded-xl bg-surface-2" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 w-full rounded-xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
