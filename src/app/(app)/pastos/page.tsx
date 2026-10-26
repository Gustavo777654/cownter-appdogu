"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowsLeftRight, CaretRight, Moon, Plant, Plus } from "@phosphor-icons/react";
import { descreverCabecas, resumoComposicao, totalCabecas } from "@/lib/composicao";
import { carregarDadosExemplo } from "@/lib/exemplo";
import { useLotesGado, usePastos } from "@/lib/hooks";
import type { LoteGado } from "@/lib/types";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DestinoPastoSheet } from "@/components/pastos/DestinoPastoSheet";
import { PastoCard } from "@/components/pastos/PastoCard";
import { PastoFormSheet } from "@/components/pastos/PastoFormSheet";

export default function PastosPage() {
  const pastos = usePastos();
  const lotes = useLotesGado();
  const router = useRouter();
  const [novo, setNovo] = useState(false);
  const [listandoSemPasto, setListandoSemPasto] = useState(false);
  const [escolhendoPasto, setEscolhendoPasto] = useState<LoteGado | null>(null);

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

  const lotesSemPasto = useMemo(() => (lotes ?? []).filter((l) => !l.pastoId), [lotes]);
  const semPasto = lotesSemPasto.length;
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
              <button
                type="button"
                onClick={() => setListandoSemPasto(true)}
                className="flex w-full items-center gap-2 rounded-xl bg-earth-100 p-3 text-left text-sm font-medium text-earth-900 active:bg-earth-200"
              >
                <Moon size={18} className="shrink-0" />
                <span className="flex-1">
                  {semPasto} {semPasto === 1 ? "lote está" : "lotes estão"} sem pasto definido. Toque para ver.
                </span>
                <CaretRight size={16} className="shrink-0" />
              </button>
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

      <BottomSheet
        open={listandoSemPasto && semPasto > 0}
        onClose={() => setListandoSemPasto(false)}
        title="Lotes sem pasto"
      >
        <ul className="space-y-2 pt-1">
          {lotesSemPasto.map((l) => (
            <li key={l.id} className="card flex items-center gap-3 p-3">
              <Link prefetch={false} href={`/lote?id=${l.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-bold text-dark">{l.nome}</span>
                <span className="block text-sm text-dark/60">
                  {descreverCabecas(totalCabecas(l.composicao))} · {resumoComposicao(l.composicao)}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setEscolhendoPasto(l)}
                className="btn-secondary min-h-10 shrink-0 px-3 text-sm"
              >
                <ArrowsLeftRight size={16} />
                Escolher pasto
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
      <DestinoPastoSheet open={!!escolhendoPasto} lote={escolhendoPasto} onClose={() => setEscolhendoPasto(null)} />

      <PastoFormSheet
        open={novo}
        onClose={() => setNovo(false)}
        onCreated={(p) => router.push(`/pasto?id=${p.id}`)}
      />
    </>
  );
}
