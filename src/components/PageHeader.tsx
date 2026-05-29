"use client";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  subtitle?: string;
  variant?: "light" | "dark";
  sticky?: boolean;
}

export function PageHeader({
  title,
  onBack,
  backLabel = "← 返回",
  subtitle,
  variant = "light",
  sticky = true,
}: PageHeaderProps) {
  const isDark = variant === "dark";

  return (
    <header
      className={`px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] ${
        sticky ? "sticky top-0 z-20" : ""
      } ${
        isDark
          ? "bg-zinc-900 text-white border-b border-zinc-800"
          : "bg-white text-zinc-900 border-b border-zinc-200"
      }`}
    >
      <div className="flex items-center gap-3 min-h-[44px]">
        <button
          type="button"
          onClick={onBack}
          className={`shrink-0 text-sm font-medium px-3 py-2.5 rounded-lg min-h-[44px] ${btnClass} ${
            isDark
              ? "text-white/90 bg-white/10"
              : "text-zinc-600 bg-zinc-100"
          }`}
        >
          {backLabel}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className={`font-bold truncate ${isDark ? "text-xl" : "text-lg"}`}>
            {title}
          </h1>
          {subtitle && (
            <p
              className={`text-sm mt-0.5 truncate ${
                isDark ? "text-white/70" : "text-zinc-500"
              }`}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
