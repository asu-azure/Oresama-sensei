import { GeometricLoader } from "@/components/geometric-loader";

// Instant fallback for the Map tab while the knowledge graph data loads.
export default function MapLoading() {
  return (
    <div className="relative py-4">
      <div className="animate-pulse space-y-5">
        <div className="h-6 w-40 rounded-lg bg-surface-2" />
        <div className="h-[60vh] w-full rounded-2xl bg-surface-2" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <GeometricLoader size={56} />
      </div>
    </div>
  );
}
