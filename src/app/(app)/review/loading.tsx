import { GeometricLoader } from "@/components/geometric-loader";

// Instant fallback while due cards are fetched server-side.
export default function ReviewLoading() {
  return (
    <div className="relative mx-auto max-w-lg py-6">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 rounded-lg bg-surface-2" />
          <div className="h-8 w-28 rounded-lg bg-surface-2" />
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-2" />
        <div className="h-64 rounded-2xl bg-surface-2" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-surface-2" />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-40 flex justify-center">
        <GeometricLoader size={48} />
      </div>
    </div>
  );
}
