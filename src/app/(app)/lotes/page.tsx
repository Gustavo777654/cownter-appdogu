"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Plant, Plus } from "@phosphor-icons/react";
import { carregarDadosExemplo } from "@/lib/exemplo";
import { useAnimais, useLotes } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoteCard } from "@/components/lotes/LoteCard";
import { LoteFormSheet } from "@/components/lotes/LoteFormSheet";

export default function LotesPage() {
  const lotes = useLotes();
  const animais = useAnimais();
  const router = useRouter();
  const [novo, setNovo] = useState(false);

  const porLote = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of animais ?? []) {
      if (a.loteId) mapa.set(a.loteId, (mapa.get(a.loteId) ?? 0) + 1);
    }
    return mapa;
  }, [animais]);

  const semPasto = animais?.filter((a) => !a.loteId).length ?? 0;
  const emUso = lotes?.filter((l) => l.situacao === "Em uso").length ?? 0;
  const reservados = lotes?.filter((l) => l.situacao === "Reservado").length ?? 0;
  const vazio = lotes !== undefined && lotes.length === 0;

  return (
    <>
      <PageHeader
        title="Lotes"
        subtitle={
          lotes && lotes.length > 0
            ? `${emUso} em uso · ${reservados} ${reservados === 1 ? "reservado" : "reservados"}`
            : "Seus pastos e o rodízio do rebanho"
        }
      />

      <div className="space-y-3 px-4">
        {lotes === undefined ? (
          <p className="py-10 text-center text-sm text-dark/50">Carregando...</p>
        ) : vazio ? (
          <div className="card flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <Plant size={36} weight="duotone" className="text-brand-700" />
            </div>
            <h2 className="text-xl font-bold text-dark">Nenhum pasto ainda</h2>
            <p className="mt-1 max-w-xs text-sm text-dark/60">
              Cadastre seus pastos para controlar o remédio, o sal, as tarefas e o rodízio do gado.
            </p>
            <button
              type="button"
              onClick={() => setNovo(true)}
              className="btn-primary mt-5 w-full max-w-xs"
            >
              <Plus size={20} weight="bold" />
              Criar pasto
            </button>
            <button
              type="button"
              onClick={() => carregarDadosExemplo()}
              className="btn-ghost mt-2 w-full max-w-xs text-sm"
            >
              Carregar dados de exemplo
            </button>
          </div>
        ) : (
          <>
            {semPasto > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-earth-100 p-3 text-sm font-medium text-earth-900">
                <Moon size={18} className="shrink-0" />
                {semPasto} {semPasto === 1 ? "animal está" : "animais estão"} sem pasto definido.
              </div>
            )}
            <ul className="space-y-3">
              {lotes.map((l) => (
                <li key={l.id}>
                  <LoteCard lote={l} qtdAnimais={porLote.get(l.id) ?? 0} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setNovo(true)}
        aria-label="Criar pasto"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition-transform active:scale-95"
      >
        <Plus size={28} weight="bold" />
      </button>

      <LoteFormSheet
        open={novo}
        onClose={() => setNovo(false)}
        onCreated={(l) => router.push(`/lote?id=${l.id}`)}
      />
    </>
  );
}
