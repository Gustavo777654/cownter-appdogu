"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { registrarVenda } from "@/lib/financas";
import { useCabecas, useLotesGado, usePartosDoLote } from "@/lib/hooks";
import { maximosMoviveis } from "@/lib/transferencia";
import { hoje } from "@/lib/utils";
import { ValorCampo, VALOR_VAZIO, lerValor, type ValorEstado } from "./ValorCampo";

export function VenderSheet({
  open,
  onClose,
  loteIdInicial,
  onVendido,
}: {
  open: boolean;
  onClose: () => void;
  /** Já deixa este lote escolhido (usado na tela do lote). */
  loteIdInicial?: string;
  onVendido?: () => void;
}) {
  const lotes = useLotesGado();
  const [loteId, setLoteId] = useState("");
  const lote = lotes?.find((l) => l.id === loteId) ?? null;
  const cabecas = useCabecas(open && loteId ? loteId : null);
  const partos = usePartosDoLote(open && loteId ? loteId : null);

  const [qtds, setQtds] = useState<string[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [valor, setValor] = useState<ValorEstado>(VALOR_VAZIO);
  const [comprador, setComprador] = useState("");
  const [data, setData] = useState(hoje());
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoteId(loteIdInicial ?? "");
    setQtds([]);
    setMarcadas(new Set());
    setValor(VALOR_VAZIO);
    setComprador("");
    setData(hoje());
    setErro("");
    setSalvando(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setQtds(lote ? lote.composicao.map(() => "") : []);
    setMarcadas(new Set());
  }, [loteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const maximos = useMemo(
    () => (lote ? maximosMoviveis(lote.composicao, (partos ?? []).filter((p) => !p.desmamado)) : []),
    [lote, partos]
  );
  const itens = (lote?.composicao ?? []).map((l, i) => ({
    sexo: l.sexo,
    categoria: l.categoria,
    quantidade: Math.max(0, Math.floor(Number(qtds[i] || 0)) || 0),
  }));
  const vendidas = itens.reduce((s, i) => s + i.quantidade, 0);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!lote) {
      setErro("Escolha o lote que foi vendido.");
      return;
    }
    const v = lerValor(valor);
    if (typeof v === "string") {
      setErro(v);
      return;
    }
    setSalvando(true);
    try {
      await registrarVenda({ loteId: lote.id, itens, cabecaIds: Array.from(marcadas), data, valor: v, comprador, observacoes: "" });
      onVendido?.();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível registrar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Registrar venda"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-venda" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : vendidas > 0 ? `Vender ${vendidas}` : "Vender"}
          </button>
        </div>
      }
    >
      <form id="form-venda" noValidate onSubmit={salvar} className="space-y-5 pt-1">
        <Erro texto={erro} />

        <div>
          <label htmlFor="vd-lote" className="field-label">
            De qual lote <span className="text-red-600">*</span>
          </label>
          <select id="vd-lote" className="field" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
            <option value="">Escolha o lote</option>
            {lotes?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
        </div>

        {lote && (
          <>
            <fieldset>
              <div className="mb-2 flex items-center justify-between gap-2">
                <legend className="field-label mb-0">Quantas cabeças foram vendidas</legend>
                <button
                  type="button"
                  onClick={() => setQtds(maximos.map((m) => String(m)))}
                  className="text-sm font-semibold text-brand-700"
                >
                  Lote inteiro
                </button>
              </div>
              <ul className="space-y-2">
                {lote.composicao.map((l, i) => (
                  <li key={`${l.sexo}-${l.categoria}`} className="flex items-center gap-3 rounded-xl border border-brand-200 bg-white p-3">
                    <label htmlFor={`vd-qtd-${i}`} className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-dark">{l.categoria}</span>
                      <span className="block text-xs text-dark/55">
                        {maximos[i] < l.quantidade ? `Pode vender ${maximos[i]} de ${l.quantidade} (o resto está com o bezerro)` : `No lote: ${l.quantidade}`}
                      </span>
                    </label>
                    <input
                      id={`vd-qtd-${i}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={maximos[i]}
                      disabled={maximos[i] === 0}
                      className="field w-24 text-center"
                      placeholder="0"
                      value={qtds[i] ?? ""}
                      onChange={(e) => setQtds((a) => a.map((v, k) => (k === i ? e.target.value : v)))}
                    />
                  </li>
                ))}
              </ul>
            </fieldset>

            {(cabecas?.length ?? 0) > 0 && (
              <details className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
                <summary className="cursor-pointer select-none text-sm font-semibold text-brand-800">Cabeças cadastradas vendidas (opcional)</summary>
                <ul className="mt-3 space-y-2">
                  {cabecas?.map((c) => (
                    <li key={c.id}>
                      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-200 bg-white p-3">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-brand-600"
                          checked={marcadas.has(c.id)}
                          onChange={() =>
                            setMarcadas((a) => {
                              const n = new Set(a);
                              if (n.has(c.id)) n.delete(c.id);
                              else n.add(c.id);
                              return n;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold text-dark">{[c.brinco, c.nome, c.cor].filter(Boolean).join(" · ")}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        <ValorCampo valor={valor} onChange={setValor} cabecas={vendidas} idBase="vd-valor" />

        <div>
          <label htmlFor="vd-comprador" className="field-label">
            Comprador (opcional)
          </label>
          <input id="vd-comprador" className="field" value={comprador} onChange={(e) => setComprador(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="vd-data" className="field-label">
            Data da venda
          </label>
          <input id="vd-data" type="date" className="field" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        </div>
        <p className="text-sm text-dark/60">As cabeças vendidas saem do lote. Se vender tudo, o lote é encerrado.</p>
      </form>
    </BottomSheet>
  );
}
