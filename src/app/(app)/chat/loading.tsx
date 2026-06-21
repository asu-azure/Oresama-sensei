import { GeometricLoader } from "@/components/geometric-loader";

// Instant fallback while the active conversation + history load.
export default function ChatLoading() {
  return (
    <div className="relative flex h-[calc(100dvh-var(--top-nav)-var(--bottom-nav))] flex-col">
      <div className="flex items-center justify-between py-3">
        <div className="h-6 w-28 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-surface-2" />
      </div>
      <div className="flex-1 animate-pulse space-y-4 py-4">
        <div className="ml-auto h-12 w-2/3 rounded-2xl bg-surface-2" />
        <div className="h-20 w-5/6 rounded-2xl bg-surface-2" />
        <div className="ml-auto h-10 w-1/2 rounded-2xl bg-surface-2" />
        <div className="h-24 w-5/6 rounded-2xl bg-surface-2" />
      </div>
      <div className="h-12 w-full animate-pulse rounded-xl bg-surface-2" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <GeometricLoader size={48} />
      </div>
    </div>
  );
}
