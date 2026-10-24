"use client";

import { useMemo, useState } from "react";
import { ArrowsLeftRight, Cow, MagnifyingGlass, Warning } from "@phosphor-icons/react";
import { moverAnimais, moverTodos } from "@/lib/lotes";
import { useAnimais, useLotes } from "@/lib/hooks";
import type { Animal, Lote } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { StatusBadge } from "@/components/ui/StatusBadge";

/** Animais que estão no pasto, com atalhos para trazer animais e mover o lote inteiro. */
export function AnimaisDoLote({ lote }: { lote: Lote }) {
  const animais = useAnimais();
  const noLote = useMemo(() => animais?.filter((a) => a.loteId === lote.id) ?? [], [animais, lote.id]);
  const [painel, setPainel] = useState<"trazer" | "mover" | null>(null);
  const reservado = lote.situacao === "Reservado";

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-dark">
        Animais <span className="text-dark/45">({noLote.length})</span>
      </h2>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setPainel("trazer")}
          disabled={reservado}
          className="btn-secondary min-h-11 flex-1 px-3 text-sm"
        >
          <Cow size={18} />
          Trazer animais
        </button>
        <button
          type="button"
          onClick={() => setPainel("mover")}
          disabled={noLote.length === 0}
          className="btn-secondary min-h-11 flex-1 px-3 text-sm"
        >
          <ArrowsLeftRight size={18} />
          Mover todos
        </button>
      </div>

      {reservado && (
        <p className="mb-3 text-sm text-earth-800">
          Este pasto está reservado (descansando). Libere-o para uso para colocar animais nele.
        </p>
      )}

      {noLote.length === 0 ? (
        <div className="card text-sm text-dark/60">Nenhum animal neste pasto.</div>
      ) : (
        <ul className="space-y-2">
          {noLote.map((a) => (
            <li key={a.id} className="card flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-dark">{a.nome || "Sem nome"}</p>
                <p className="text-sm font-semibold text-brand-700">{a.brinco}</p>
              </div>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      )}

      <TrazerSheet
        open={painel === "trazer"}
        lote={lote}
        onClose={() => setPainel(null)}
      />
      <MoverTodosSheet
        open={painel === "mover"}
        lote={lote}
        qtd={noLote.length}
        onClose={() => setPainel(null)}
      />
    </section>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
    >
      <Warning size={20} weight="fill" className="mt-0.5 shrink-0" />
      {texto}
    </div>
  );
}

/** Escolhe animais de outros pastos (ou sem pasto) para trazer para este. */
function TrazerSheet({ open, lote, onClose }: { open: boolean; lote: Lote; onClose: () => void }) {
  const animais = useAnimais();
  const lotes = useLotes();
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const nomeDoLote = useMemo(() => new Map(lotes?.map((l) => [l.id, l.nome])), [lotes]);

  const candidatos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (animais ?? []).filter(
      (a: Animal) =>
        a.loteId !== lote.id &&
        (!termo || a.brinco.toLowerCase().includes(termo) || a.nome.toLowerCase().includes(termo))
    );
  }, [animais, busca, lote.id]);

  function fechar() {
    setMarcados(new Set());
    setBusca("");
    setErro("");
    onClose();
  }

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function confirmar() {
    setErro("");
    setSalvando(true);
    try {
      await moverAnimais(Array.from(marcados), lote.id);
      fechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível mover.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={fechar}
      title={`Trazer para ${lote.nome}`}
      footer={
        <button
          type="button"
          onClick={confirmar}
          disabled={salvando || marcados.size === 0}
          className="btn-primary w-full"
        >
          {marcados.size === 0
            ? "Selecione os animais"
            : `Trazer ${marcados.size} ${marcados.size === 1 ? "animal" : "animais"}`}
        </button>
      }
    >
      <div className="space-y-3 pt-1">
        {erro && <Erro texto={erro} />}
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

        {candidatos.length === 0 ? (
          <p className="py-6 text-center text-sm text-dark/50">Nenhum animal para trazer.</p>
        ) : (
          <ul className="space-y-2">
            {candidatos.map((a) => {
              const marcado = marcados.has(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => alternar(a.id)}
                    aria-pressed={marcado}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      marcado ? "border-brand-600 bg-brand-50" : "border-brand-100 bg-white"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold",
                        marcado
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-dark/25 text-transparent"
                      )}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-dark">
                        {a.nome || "Sem nome"}{" "}
                        <span className="font-semibold text-brand-700">{a.brinco}</span>
                      </span>
                      <span className="block text-xs text-dark/55">
                        {a.loteId ? `Está em ${nomeDoLote.get(a.loteId) ?? "outro pasto"}` : "Sem pasto"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
}

/** Move todos os animais do pasto para outro: o gesto do rodízio. */
function MoverTodosSheet({
  open,
  lote,
  qtd,
  onClose,
}: {
  open: boolean;
  lote: Lote;
  qtd: number;
  onClose: () => void;
}) {
  const lotes = useLotes();
  const [destino, setDestino] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const opcoes = (lotes ?? []).filter((l) => l.id !== lote.id);

  function fechar() {
    setDestino("");
    setErro("");
    onClose();
  }

  async function confirmar() {
    setErro("");
    setSalvando(true);
    try {
      await moverTodos(lote.id, destino === "__nenhum" ? null : destino);
      fechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível mover.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={fechar}
      title={`Mover todos de ${lote.nome}`}
      footer={
        <button
          type="button"
          onClick={confirmar}
          disabled={salvando || !destino}
          className="btn-primary w-full"
        >
          {salvando ? "Movendo..." : `Mover ${qtd} ${qtd === 1 ? "animal" : "animais"}`}
        </button>
      }
    >
      <div className="space-y-3 pt-1">
        {erro && <Erro texto={erro} />}
        <label htmlFor="destino" className="field-label">
          Para qual pasto?
        </label>
        <select
          id="destino"
          className="field"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
        >
          <option value="">Escolha o pasto</option>
          {opcoes.map((l) => (
            <option key={l.id} value={l.id} disabled={l.situacao === "Reservado"}>
              {l.nome}
              {l.situacao === "Reservado" ? " (reservado)" : ""}
            </option>
          ))}
          <option value="__nenhum">Deixar sem pasto</option>
        </select>
        <p className="text-sm text-dark/55">
          Pastos reservados (descansando) não aparecem como opção. Libere o pasto antes, se quiser usá-lo.
        </p>
      </div>
    </BottomSheet>
  );
}
