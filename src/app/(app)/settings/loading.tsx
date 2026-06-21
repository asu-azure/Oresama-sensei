import { GeometricLoader } from "@/components/geometric-loader";

// Instant fallback while the profile loads server-side.
export default function SettingsLoading() {
  return (
    <div className="relative max-w-xl py-4">
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-40 rounded-lg bg-surface-2" />
        <div className="h-10 w-full rounded-md bg-surface-2" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 rounded-md bg-surface-2" />
          <div className="h-10 rounded-md bg-surface-2" />
        </div>
        <div className="h-28 w-full rounded-md bg-surface-2" />
        <div className="h-10 w-full rounded-md bg-surface-2" />
        <div className="h-10 w-32 rounded-md bg-surface-2" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-32 flex justify-center">
        <GeometricLoader size={48} />
      </div>
    </div>
  );
}
