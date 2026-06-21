import { GeometricLoader } from "@/components/geometric-loader";

// Instant fallback while lessons are fetched server-side.
export default function LessonsLoading() {
  return (
    <div className="relative py-4">
      <div className="animate-pulse space-y-5">
        <div className="h-7 w-32 rounded-lg bg-surface-2" />
        <div className="h-28 w-full rounded-2xl bg-surface-2" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-xl bg-surface-2" />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
        <GeometricLoader size={48} />
      </div>
    </div>
  );
}
