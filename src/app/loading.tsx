import { PageSkeleton } from "@/components/PageSkeleton";

export default function AppLoading() {
  return (
    <div className="min-h-screen bg-white pb-32 max-w-lg mx-auto w-full">
      <div className="pt-[max(1.25rem,env(safe-area-inset-top))] px-4 pb-4">
        <div className="h-8 w-28 rounded-xl bg-zinc-100 animate-pulse" />
      </div>
      <main className="px-4 py-5">
        <PageSkeleton rows={4} />
      </main>
    </div>
  );
}
