"use client";

import { useMemo, useState } from "react";
import { ArrowsLeftRight, Plus } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { descreverCabecas, totalCabecas, totalDeLotes } from "@/lib/composicao";
import { moverLoteGado } from "@/lib/gado";
import { useLotesGado, usePastos } from "@/lib/hooks";
import type { LoteGado, Pasto } from "@/lib/types";
import { LoteGadoCard } from "@/components/gado/LoteGadoCard";
import { LoteGadoFormSheet } from "@/components/gado/LoteGadoFormSheet";
import { DestinoPastoSheet } from "./DestinoPastoSheet";

/**
 * Lotes de gado que estão no pasto.
 * "Mover" abre a lista de todos os lotes: escolher um lote que já está aqui abre a lista de pastos
 * de destino; escolher um lote de fora traz o lote para este pasto.
 */
export function LotesDoPasto({ pasto }: { pasto: Pasto }) {
  const lotes = useLotesGado();
  const pastos = usePastos();
  const [listando, setListando] = useState(false);
  const [trazendo, setTrazendo] = useState<LoteGado | null>(null);
  const [saindo, setSaindo] = useState<LoteGado | null>(null);
  const [novo, setNovo] = useState(false);
  const reservado = pasto.situacao === "Reservado";

  const aqui = useMemo(() => lotes?.filter((l) => l.pastoId === pasto.id) ?? [], [lotes, pasto.id]);

  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-dark">
        Lotes de gado <span className="text-dark/45">({descreverCabecas(totalDeLotes(aqui))})</span>
      </h2>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setListando(true)}
          disabled={!lotes || lotes.length === 0}
          className="btn-secondary min-h-11 flex-1 px-3 text-sm"
        >
          <ArrowsLeftRight size={18} />
          Mover lote
        </button>
        <button
          type="button"
          onClick={() => setNovo(true)}
          disabled={reservado}
          className="btn-secondary min-h-11 flex-1 px-3 text-sm"
        >
          <Plus size={18} weight="bold" />
          Novo lote aqui
        </button>
      </div>

      {reservado && (
        <p className="mb-3 text-sm text-earth-800">
          Este pasto está reservado (descansando). Libere-o para uso para colocar lotes nele.
        </p>
      )}

      {aqui.length === 0 ? (
        <div className="card text-sm text-dark/60">Nenhum lote neste pasto.</div>
      ) : (
        <ul className="space-y-2">
          {aqui.map((l) => (
            <li key={l.id}>
              <LoteGadoCard lote={l} mostrarPasto={false} />
            </li>
          ))}
        </ul>
      )}

      <EscolherLoteSheet
        open={listando}
        pasto={pasto}
        lotes={lotes ?? []}
        nomesPastos={new Map((pastos ?? []).map((p) => [p.id, p.nome]))}
        onClose={() => setListando(false)}
        onEscolher={(l) => {
          setListando(false);
          if (l.pastoId === pasto.id) setSaindo(l);
          else setTrazendo(l);
        }}
      />
      <TrazerLoteSheet pasto={pasto} lote={trazendo} onClose={() => setTrazendo(null)} />
      <DestinoPastoSheet open={!!saindo} lote={saindo} onClose={() => setSaindo(null)} />
      <LoteGadoFormSheet open={novo} pastoInicial={pasto.id} onClose={() => setNovo(false)} />
    </section>
  );
}

function EscolherLoteSheet({
  open,
  pasto,
  lotes,
  nomesPastos,
  onClose,
  onEscolher,
}: {
  open: boolean;
  pasto: Pasto;
  lotes: LoteGado[];
  nomesPastos: Map<string, string>;
  onClose: () => void;
  onEscolher: (lote: LoteGado) => void;
}) {
  const aqui = lotes.filter((l) => l.pastoId === pasto.id);
  const fora = lotes.filter((l) => l.pastoId !== pasto.id);
  const reservado = pasto.situacao === "Reservado";

  const item = (l: LoteGado, onde: string, bloqueado: boolean) => (
    <li key={l.id}>
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => onEscolher(l)}
        className="flex w-full items-center gap-3 rounded-xl border border-brand-200 bg-white p-3 text-left active:bg-brand-50 disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-dark">{l.nome}</span>
          <span className="block text-xs text-dark/55">
            {descreverCabecas(totalCabecas(l.composicao))} · {onde}
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Mover lote">
      <div className="space-y-4 pt-1">
        <p className="text-sm text-dark/60">
          Escolha o lote. Se ele já está neste pasto, você escolhe para onde ele vai. Se está em outro lugar, ele vem para
          cá.
        </p>

        {aqui.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold text-dark/70">Neste pasto (vão sair)</h3>
            <ul className="space-y-2">{aqui.map((l) => item(l, "neste pasto", false))}</ul>
          </div>
        )}

        {fora.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold text-dark/70">De outros lugares (vêm para cá)</h3>
            {reservado && (
              <p className="mb-2 text-xs text-earth-800">Pasto reservado: libere-o antes de trazer lotes.</p>
            )}
            <ul className="space-y-2">
              {fora.map((l) => item(l, l.pastoId ? (nomesPastos.get(l.pastoId) ?? "outro pasto") : "sem pasto", reservado))}
            </ul>
          </div>
        )}

        {lotes.length === 0 && <p className="text-sm text-dark/60">Nenhum lote cadastrado ainda.</p>}
      </div>
    </BottomSheet>
  );
}

function TrazerLoteSheet({ pasto, lote, onClose }: { pasto: Pasto; lote: LoteGado | null; onClose: () => void }) {
  const [erro, setErro] = useState("");
  const [movendo, setMovendo] = useState(false);

  async function confirmar() {
    if (!lote) return;
    setErro("");
    setMovendo(true);
    try {
      await moverLoteGado(lote.id, pasto.id);
      setMovendo(false);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível mover.");
      setMovendo(false);
    }
  }

  return (
    <BottomSheet
      open={!!lote}
      onClose={onClose}
      title="Trazer lote"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={movendo} className="btn-primary flex-1">
            {movendo ? "Movendo..." : "Trazer"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 pt-1">
        <Erro texto={erro} />
        {lote && (
          <p className="text-base text-dark/80">
            Trazer <strong>{lote.nome}</strong> ({descreverCabecas(totalCabecas(lote.composicao))}) para{" "}
            <strong>{pasto.nome}</strong>?
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
