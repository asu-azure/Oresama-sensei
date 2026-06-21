import { GeometricLoader } from "@/components/geometric-loader";

// Instant fallback while collections are fetched server-side.
export default function BooksLoading() {
  return (
    <div className="relative py-4">
      <div className="animate-pulse space-y-5">
        <div className="h-7 w-32 rounded-lg bg-surface-2" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-surface-2" />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
        <GeometricLoader size={48} />
      </div>
    </div>
  );
}
