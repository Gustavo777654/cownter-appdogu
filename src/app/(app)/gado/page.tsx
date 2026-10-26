"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Cow, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { descreverCabecas, totalDeLotes } from "@/lib/composicao";
import { carregarDadosExemplo } from "@/lib/exemplo";
import { useLotesGado, usePastos } from "@/lib/hooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoteGadoCard } from "@/components/gado/LoteGadoCard";
import { LoteGadoFormSheet } from "@/components/gado/LoteGadoFormSheet";

export default function GadoPage() {
  const lotes = useLotesGado();
  const pastos = usePastos();
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);

  // O atalho da tela inicial abre direto o cadastro: /gado?novo=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") {
      setNovo(true);
      window.history.replaceState(null, "", "/gado");
    }
  }, []);

  const nomesPastos = useMemo(() => new Map((pastos ?? []).map((p) => [p.id, p.nome])), [pastos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (lotes ?? []).filter((l) => !termo || l.nome.toLowerCase().includes(termo));
  }, [lotes, busca]);

  const vazio = lotes !== undefined && lotes.length === 0;

  return (
    <>
      <PageHeader
        title="Gado"
        subtitle={
          lotes && lotes.length > 0
            ? `${lotes.length} ${lotes.length === 1 ? "lote" : "lotes"} · ${descreverCabecas(totalDeLotes(lotes))}`
            : "Seus lotes de gado"
        }
      />

      {lotes && lotes.length > 0 && (
        <div className="px-4 pb-3">
          <div className="relative">
            <MagnifyingGlass size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dark/40" />
            <input
              className="field pl-12"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar lote pelo nome"
              aria-label="Buscar lote"
              autoComplete="off"
            />
          </div>
        </div>
      )}

      <div className="space-y-3 px-4">
        {lotes === undefined ? (
          <p className="py-10 text-center text-sm text-dark/50">Carregando...</p>
        ) : vazio ? (
          <div className="card flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <Cow size={36} weight="duotone" className="text-brand-700" />
            </div>
            <h2 className="text-xl font-bold text-dark">Nenhum lote ainda</h2>
            <p className="mt-1 max-w-xs text-sm text-dark/60">
              Cadastre o primeiro lote de gado: basta o nome e quantas cabeças tem.
            </p>
            <button type="button" onClick={() => setNovo(true)} className="btn-primary mt-5 w-full max-w-xs">
              <Plus size={20} weight="bold" />
              Cadastrar lote
            </button>
            <button
              type="button"
              onClick={() => carregarDadosExemplo()}
              className="btn-ghost mt-2 w-full max-w-xs text-sm"
            >
              Carregar dados de exemplo
            </button>
          </div>
        ) : filtrados.length === 0 ? (
          <p className="py-10 text-center text-sm text-dark/55">Nenhum lote encontrado com esse nome.</p>
        ) : (
          <ul className="space-y-3">
            {filtrados.map((l) => (
              <li key={l.id}>
                <LoteGadoCard lote={l} pastoNome={l.pastoId ? (nomesPastos.get(l.pastoId) ?? null) : null} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setNovo(true)}
        aria-label="Cadastrar lote de gado"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition-transform active:scale-95"
      >
        <Plus size={28} weight="bold" />
      </button>

      <LoteGadoFormSheet
        open={novo}
        onClose={() => setNovo(false)}
        onCreated={(l) => router.push(`/lote?id=${l.id}`)}
      />
    </>
  );
}
