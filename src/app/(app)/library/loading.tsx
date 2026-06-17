import { GeometricLoader } from "@/components/geometric-loader";

// Instant fallback shown the moment the Vocab tab is tapped, while the server
// fetches the items. Mirrors the real layout (heat-map + filter chips + a list
// of compact rows) so the switch feels immediate instead of a ~5s blank wait.
export default function LibraryLoading() {
  return (
    <div className="relative py-4">
      <div className="animate-pulse space-y-5">
        <div className="h-7 w-44 rounded-lg bg-surface-2" />
        <div className="h-24 w-full rounded-2xl bg-surface-2" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-full bg-surface-2" />
          ))}
        </div>
        <div className="h-11 w-full rounded-xl bg-surface-2" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded-xl bg-surface-2" />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
        <GeometricLoader size={48} />
      </div>
    </div>
  );
}
