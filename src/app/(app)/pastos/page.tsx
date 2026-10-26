"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Plant, Plus } from "@phosphor-icons/react";
import { totalCabecas } from "@/lib/composicao";
import { carregarDadosExemplo } from "@/lib/exemplo";
import { useLotesGado, usePastos } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { PastoCard } from "@/components/pastos/PastoCard";
import { PastoFormSheet } from "@/components/pastos/PastoFormSheet";

export default function PastosPage() {
  const pastos = usePastos();
  const lotes = useLotesGado();
  const router = useRouter();
  const [novo, setNovo] = useState(false);

  // O atalho da tela inicial abre direto o cadastro: /pastos?novo=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") {
      setNovo(true);
      window.history.replaceState(null, "", "/pastos");
    }
  }, []);

  const porPasto = useMemo(() => {
    const mapa = new Map<string, { lotes: number; cabecas: number }>();
    for (const l of lotes ?? []) {
      if (!l.pastoId) continue;
      const atual = mapa.get(l.pastoId) ?? { lotes: 0, cabecas: 0 };
      mapa.set(l.pastoId, { lotes: atual.lotes + 1, cabecas: atual.cabecas + totalCabecas(l.composicao) });
    }
    return mapa;
  }, [lotes]);

  const semPasto = lotes?.filter((l) => !l.pastoId).length ?? 0;
  const emUso = pastos?.filter((p) => p.situacao === "Em uso").length ?? 0;
  const reservados = pastos?.filter((p) => p.situacao === "Reservado").length ?? 0;
  const vazio = pastos !== undefined && pastos.length === 0;

  return (
    <>
      <PageHeader
        title="Pastos"
        subtitle={
          pastos && pastos.length > 0
            ? `${emUso} em uso · ${reservados} descansando`
            : "Seus pastos e o rodízio do gado"
        }
      />

      <div className="space-y-3 px-4">
        {pastos === undefined ? (
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
            <button type="button" onClick={() => setNovo(true)} className="btn-primary mt-5 w-full max-w-xs">
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
                {semPasto} {semPasto === 1 ? "lote está" : "lotes estão"} sem pasto definido.
              </div>
            )}
            <ul className="space-y-3">
              {pastos.map((p) => {
                const dados = porPasto.get(p.id);
                return (
                  <li key={p.id}>
                    <PastoCard pasto={p} qtdLotes={dados?.lotes ?? 0} qtdCabecas={dados?.cabecas ?? 0} />
                  </li>
                );
              })}
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

      <PastoFormSheet
        open={novo}
        onClose={() => setNovo(false)}
        onCreated={(p) => router.push(`/pasto?id=${p.id}`)}
      />
    </>
  );
}
