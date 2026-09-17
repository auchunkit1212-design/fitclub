export function PageSkeleton({
  rows = 4,
}: {
  rows?: number;
}) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-24 rounded-3xl bg-zinc-100 animate-pulse"
        />
      ))}
    </div>
  );
}
