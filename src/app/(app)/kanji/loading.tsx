import { GeometricLoader } from "@/components/geometric-loader";

export default function KanjiLoading() {
  return (
    <div className="relative py-4">
      <div className="animate-pulse space-y-5">
        <div className="h-7 w-28 rounded-lg bg-surface-2" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-12 rounded-full bg-surface-2" />
          ))}
        </div>
        <div className="h-11 w-full rounded-xl bg-surface-2" />
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {Array.from({ length: 32 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-surface-2" />
          ))}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center">
        <GeometricLoader size={48} />
      </div>
    </div>
  );
}
