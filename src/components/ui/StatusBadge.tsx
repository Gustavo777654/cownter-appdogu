import type { AnimalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTILOS: Record<AnimalStatus, string> = {
  Saudável: "bg-brand-100 text-brand-800",
  "Vacinação pendente": "bg-amber-100 text-amber-800",
  "Em tratamento": "bg-red-100 text-red-700",
};

export function StatusBadge({ status }: { status: AnimalStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        ESTILOS[status]
      )}
    >
      {status}
    </span>
  );
}
