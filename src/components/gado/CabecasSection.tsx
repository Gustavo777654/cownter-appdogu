"use client";

import { useState } from "react";
import { CaretDown, Plus } from "@phosphor-icons/react";
import { totalCabecas } from "@/lib/composicao";
import { useCabecas } from "@/lib/hooks";
import type { Cabeca, LoteGado } from "@/lib/types";
import { cn, formatIdade } from "@/lib/utils";
import { CabecaFormSheet } from "./CabecaFormSheet";

function rotulo(c: Cabeca): string {
  return [c.brinco, c.nome, c.cor].filter(Boolean).join(" · ");
}

/** Cabeças cadastradas uma a uma dentro do lote (opcional). */
export function CabecasSection({ lote }: { lote: LoteGado }) {
  const cabecas = useCabecas(lote.id);
  const [aberta, setAberta] = useState<Cabeca | null>(null);
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState(false);
  const total = totalCabecas(lote.composicao);
  const cadastradas = cabecas?.length ?? 0;
  const completo = cadastradas >= total;

  return (
    <section>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="card flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1 text-xl font-bold text-dark">
          Cabeças cadastradas <span className="text-dark/45">({cadastradas})</span>
        </span>
        <CaretDown size={20} className={cn("shrink-0 text-dark/50 transition-transform", aberto && "rotate-180")} />
      </button>

      {aberto && (
        <div className="mt-3">
          <p className="mb-3 text-sm text-dark/60">
            Opcional. Cadastre uma cabeça para acompanhar ela separada do lote (brinco, cor ou nome).
          </p>

          <button
            type="button"
            onClick={() => setNovo(true)}
            disabled={completo}
            className="btn-secondary mb-3 min-h-11 w-full text-sm"
          >
            <Plus size={18} weight="bold" />
            Cadastrar cabeça
          </button>
          {completo && total > 0 && cadastradas > 0 && (
            <p className="mb-3 text-xs text-dark/55">Todas as {total} cabeças do lote já estão cadastradas.</p>
          )}

          {cadastradas > 0 && (
            <ul className="space-y-2">
              {cabecas?.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setAberta(c)}
                    className="card flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-dark">{rotulo(c)}</p>
                      <p className="truncate text-sm text-dark/60">
                        {c.sexo}
                        {c.raca && ` · ${c.raca}`}
                        {c.dataNascimento && ` · ${formatIdade(c.dataNascimento)}`}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <CabecaFormSheet open={novo} loteGadoId={lote.id} racaSugerida={lote.raca} onClose={() => setNovo(false)} />
      <CabecaFormSheet
        open={!!aberta}
        loteGadoId={lote.id}
        cabeca={aberta}
        onClose={() => setAberta(null)}
      />
    </section>
  );
}
