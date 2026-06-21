import { GeometricLoader } from "@/components/geometric-loader";

// Instant fallback while the SNS helper loads (profile + history).
export default function SnsLoading() {
  return (
    <div className="relative mx-auto max-w-2xl py-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-32 rounded-lg bg-surface-2" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-2" />
          ))}
        </div>
        <div className="h-16 w-full rounded-xl bg-surface-2" />
        <div className="h-16 w-full rounded-xl bg-surface-2" />
        <div className="h-10 w-40 rounded-md bg-surface-2" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-32 flex justify-center">
        <GeometricLoader size={48} />
      </div>
    </div>
  );
}
