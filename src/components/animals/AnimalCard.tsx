import { Cow } from "@phosphor-icons/react";
import type { Animal } from "@/lib/types";
import { formatIdade, formatPeso } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface AnimalCardProps {
  animal: Animal;
  /** Nome do pasto onde o animal está (vazio quando não tem pasto). */
  nomeLote?: string;
  onSelect: (animal: Animal) => void;
}

/** Cartão do animal na lista: o toque abre os detalhes. */
export function AnimalCard({ animal, nomeLote, onSelect }: AnimalCardProps) {
  const detalhes = [
    nomeLote,
    animal.raca,
    animal.sexo,
    formatIdade(animal.dataNascimento),
    animal.pesoKg !== null ? formatPeso(animal.pesoKg) : "",
  ]
    .filter((d) => d && d !== "—")
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onSelect(animal)}
      className="card flex w-full items-center gap-3 text-left transition-all active:scale-[0.99] active:bg-brand-50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100">
        <Cow size={26} weight="duotone" className="text-brand-700" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-dark">
              {animal.nome || "Sem nome"}
            </p>
            <p className="text-sm font-semibold text-brand-700">{animal.brinco}</p>
          </div>
          <StatusBadge status={animal.status} />
        </div>
        {detalhes && <p className="mt-1 truncate text-xs text-dark/60">{detalhes}</p>}
      </div>
    </button>
  );
}
