import { Cow } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function Logo({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const grande = size === "lg";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30",
          grande ? "h-16 w-16" : "h-10 w-10"
        )}
      >
        <Cow size={grande ? 36 : 22} weight="fill" className="text-white" />
      </div>
      <span
        className={cn(
          "font-display font-bold tracking-wide text-dark",
          grande ? "text-3xl" : "text-xl"
        )}
      >
        COWNTER
      </span>
    </div>
  );
}
