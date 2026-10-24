"use client";

import { useEffect, useMemo, useState } from "react";
import { Cow, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { carregarDadosExemplo } from "@/lib/exemplo";
import { useAnimais, useLotes } from "@/lib/hooks";
import { STATUS_LIST, type Animal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { AnimalCard } from "@/components/animals/AnimalCard";
import { AnimalDetailSheet } from "@/components/animals/AnimalDetailSheet";
import { AnimalFormSheet } from "@/components/animals/AnimalFormSheet";
import { ConfirmDeleteSheet } from "@/components/animals/ConfirmDeleteSheet";

type Filtro = "Todos" | (typeof STATUS_LIST)[number];
const FILTROS: Filtro[] = ["Todos", ...STATUS_LIST];

// Guardamos só o id: assim os painéis sempre mostram a versão mais recente do banco.
type Painel =
  | { tipo: "novo" }
  | { tipo: "ver"; id: string }
  | { tipo: "editar"; id: string }
  | { tipo: "excluir"; id: string }
  | null;

export default function RebanhoPage() {
  const animais = useAnimais();
  const lotes = useLotes();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Todos");
  const [painel, setPainel] = useState<Painel>(null);

  // Atalho da tela inicial: /rebanho?novo=1 abre o cadastro direto.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("novo") === "1") {
      setPainel({ tipo: "novo" });
      window.history.replaceState(null, "", "/rebanho");
    }
  }, []);

  const nomeDoLote = useMemo(() => new Map(lotes?.map((l) => [l.id, l.nome])), [lotes]);

  const filtrados = useMemo(() => {
    if (!animais) return [];
    const termo = busca.trim().toLowerCase();
    return animais.filter(
      (a) =>
        (filtro === "Todos" || a.status === filtro) &&
        (!termo ||
          a.brinco.toLowerCase().includes(termo) ||
          a.nome.toLowerCase().includes(termo))
    );
  }, [animais, busca, filtro]);

  const animalDoPainel: Animal | null =
    painel && painel.tipo !== "novo"
      ? (animais?.find((a) => a.id === painel.id) ?? null)
      : null;

  const fechar = () => setPainel(null);
  const rebanhoVazio = animais !== undefined && animais.length === 0;

  return (
    <>
      <PageHeader
        title="Rebanho"
        subtitle={animais ? `${animais.length} ${animais.length === 1 ? "animal" : "animais"}` : " "}
      />

      <div className="space-y-3 px-4">
        <div className="relative">
          <MagnifyingGlass
            size={20}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dark/40"
          />
          <input
            type="search"
            className="field pl-11"
            placeholder="Buscar por brinco ou nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar animal"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTROS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
                filtro === f
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-dark/70"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {animais === undefined ? (
          <p className="py-10 text-center text-sm text-dark/50">Carregando...</p>
        ) : rebanhoVazio ? (
          <div className="card flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <Cow size={36} weight="duotone" className="text-brand-700" />
            </div>
            <h2 className="text-xl font-bold text-dark">Nenhum animal ainda</h2>
            <p className="mt-1 max-w-xs text-sm text-dark/60">
              Cadastre o primeiro animal do seu rebanho. Tudo fica salvo no aparelho, mesmo sem
              internet.
            </p>
            <button
              type="button"
              onClick={() => setPainel({ tipo: "novo" })}
              className="btn-primary mt-5 w-full max-w-xs"
            >
              <Plus size={20} weight="bold" />
              Cadastrar animal
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
          <p className="py-10 text-center text-sm text-dark/50">
            Nenhum animal encontrado com esses filtros.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtrados.map((a) => (
              <li key={a.id}>
                <AnimalCard
                  animal={a}
                  nomeLote={a.loteId ? nomeDoLote.get(a.loteId) : undefined}
                  onSelect={(x) => setPainel({ tipo: "ver", id: x.id })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPainel({ tipo: "novo" })}
        aria-label="Cadastrar animal"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl shadow-brand-600/30 transition-transform active:scale-95"
      >
        <Plus size={28} weight="bold" />
      </button>

      <AnimalDetailSheet
        animal={painel?.tipo === "ver" ? animalDoPainel : null}
        onClose={fechar}
        onEdit={(a) => setPainel({ tipo: "editar", id: a.id })}
        onDelete={(a) => setPainel({ tipo: "excluir", id: a.id })}
      />
      <AnimalFormSheet
        open={painel?.tipo === "novo" || (painel?.tipo === "editar" && !!animalDoPainel)}
        animal={painel?.tipo === "editar" ? animalDoPainel : null}
        onClose={fechar}
      />
      <ConfirmDeleteSheet
        animal={painel?.tipo === "excluir" ? animalDoPainel : null}
        onClose={fechar}
        onDeleted={fechar}
      />
    </>
  );
}
