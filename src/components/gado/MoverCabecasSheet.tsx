"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { Segmented } from "@/components/ui/Segmented";
import { descreverCabecas } from "@/lib/composicao";
import { useCabecas, useLotesGado, usePartosDoLote } from "@/lib/hooks";
import { maximosMoviveis, moverCabecas, type DestinoMover } from "@/lib/transferencia";
import type { LoteGado } from "@/lib/types";

interface Props {
  open: boolean;
  lote: LoteGado;
  onClose: () => void;
}

/** Move só algumas cabeças deste lote para outro lote (existente ou novo). */
export function MoverCabecasSheet({ open, lote, onClose }: Props) {
  const lotes = useLotesGado();
  const cabecas = useCabecas(open ? lote.id : null);
  const partos = usePartosDoLote(open ? lote.id : null);
  const outros = (lotes ?? []).filter((l) => l.id !== lote.id);

  const [qtds, setQtds] = useState<string[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [modo, setModo] = useState<"Lote existente" | "Lote novo">("Lote existente");
  const [loteId, setLoteId] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const maximos = useMemo(
    () => maximosMoviveis(lote.composicao, (partos ?? []).filter((p) => !p.desmamado)),
    [lote.composicao, partos]
  );

  useEffect(() => {
    if (!open) return;
    setQtds(lote.composicao.map(() => ""));
    setMarcadas(new Set());
    setModo(outros.length > 0 ? "Lote existente" : "Lote novo");
    setLoteId("");
    setNome("");
    setErro("");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const itens = lote.composicao.map((l, i) => ({
    sexo: l.sexo,
    categoria: l.categoria,
    quantidade: Math.max(0, Math.floor(Number(qtds[i] || 0)) || 0),
  }));
  const totalSaindo = itens.reduce((s, i) => s + i.quantidade, 0);

  function alternar(id: string) {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (modo === "Lote existente" && !loteId) {
      setErro("Escolha o lote para onde as cabeças vão.");
      return;
    }
    const destino: DestinoMover = modo === "Lote novo" ? { tipo: "novo", nome } : { tipo: "lote", loteId };
    setSalvando(true);
    try {
      await moverCabecas(lote.id, itens, Array.from(marcadas), destino);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível mover.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Mover cabeças"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-mover-cabecas" disabled={salvando || totalSaindo === 0} className="btn-primary flex-1">
            {salvando ? "Movendo..." : totalSaindo > 0 ? `Mover ${totalSaindo}` : "Mover"}
          </button>
        </div>
      }
    >
      <form id="form-mover-cabecas" noValidate onSubmit={confirmar} className="space-y-5 pt-1">
        <Erro texto={erro} />

        <fieldset>
          <legend className="field-label">Quantas cabeças de cada tipo vão sair</legend>
          <ul className="space-y-2">
            {lote.composicao.map((l, i) => (
              <li key={`${l.sexo}-${l.categoria}`} className="flex items-center gap-3 rounded-xl border border-brand-200 bg-white p-3">
                <label htmlFor={`mc-qtd-${i}`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-dark">{l.categoria}</span>
                  <span className="block text-xs text-dark/55">
                    {maximos[i] < l.quantidade
                      ? `Pode sair ${maximos[i]} de ${l.quantidade} (as outras ficam com o bezerro)`
                      : `No lote: ${l.quantidade}`}
                  </span>
                </label>
                <input
                  id={`mc-qtd-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={maximos[i]}
                  disabled={maximos[i] === 0}
                  className="field w-24 text-center"
                  value={qtds[i] ?? ""}
                  placeholder="0"
                  onChange={(e) => setQtds((a) => a.map((v, k) => (k === i ? e.target.value : v)))}
                />
              </li>
            ))}
          </ul>
        </fieldset>

        {(cabecas?.length ?? 0) > 0 && (
          <details className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <summary className="cursor-pointer select-none text-sm font-semibold text-brand-800">
              Cabeças cadastradas que vão junto (opcional)
            </summary>
            <ul className="mt-3 space-y-2">
              {cabecas?.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-200 bg-white p-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand-600"
                      checked={marcadas.has(c.id)}
                      onChange={() => alternar(c.id)}
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold text-dark">
                      {[c.brinco, c.nome, c.cor].filter(Boolean).join(" · ")}{" "}
                      <span className="text-xs font-normal text-dark/55">({c.sexo === "Fêmea" ? "fêmea" : "macho"})</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        )}

        <Segmented
          label="Para onde elas vão"
          value={modo}
          options={["Lote existente", "Lote novo"] as const}
          onChange={setModo}
        />

        {modo === "Lote existente" ? (
          <div>
            <label htmlFor="mc-lote" className="field-label">
              Lote de destino
            </label>
            <select id="mc-lote" className="field" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              <option value="">Escolha um lote</option>
              {outros.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="mc-nome" className="field-label">
              Nome do novo lote
            </label>
            <input id="mc-nome" className="field" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
            <p className="mt-1.5 text-xs text-dark/55">O lote novo fica no mesmo pasto deste lote.</p>
          </div>
        )}

        <p className="text-sm text-dark/60">
          {descreverCabecas(totalSaindo)} {totalSaindo === 1 ? "sai" : "saem"} de {lote.nome}.
        </p>
      </form>
    </BottomSheet>
  );
}
