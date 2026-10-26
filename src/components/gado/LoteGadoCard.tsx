import Link from "next/link";
import { CaretRight, Cow, Plant, Tag } from "@phosphor-icons/react";
import { descreverCabecas, resumoComposicao, totalCabecas } from "@/lib/composicao";
import type { LoteGado } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LoteGadoCardProps {
  lote: LoteGado;
  /** Nome do pasto onde o lote está (null = sem pasto). Omita para esconder a linha do pasto. */
  pastoNome?: string | null;
  mostrarPasto?: boolean;
}

export function LoteGadoCard({ lote, pastoNome = null, mostrarPasto = true }: LoteGadoCardProps) {
  const venda = lote.situacao === "Separado para venda";
  const total = totalCabecas(lote.composicao);

  return (
    <Link
      prefetch={false}
      href={`/lote?id=${lote.id}`}
      className={cn(
        "card block transition-all active:scale-[0.99] active:bg-brand-50",
        venda && "border-amber-300 bg-amber-50/60"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            venda ? "bg-amber-100 text-amber-700" : "bg-brand-100 text-brand-700"
          )}
        >
          <Cow size={26} weight="duotone" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-base font-bold text-dark">{lote.nome}</p>
            <span className="shrink-0 text-base font-bold text-brand-700">{descreverCabecas(total)}</span>
          </div>
          <p className="mt-0.5 text-sm text-dark/60">{resumoComposicao(lote.composicao)}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dark/70">
            {mostrarPasto && (
              <span className="inline-flex items-center gap-1.5">
                <Plant size={16} className="text-brand-700" />
                {pastoNome ?? "Sem pasto"}
              </span>
            )}
            {venda && (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
                <Tag size={16} />
                Separado para venda
              </span>
            )}
          </div>
        </div>
        <CaretRight size={18} className="mt-3 shrink-0 text-dark/30" />
      </div>
    </Link>
  );
}
