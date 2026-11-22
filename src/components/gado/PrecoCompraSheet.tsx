"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { Segmented } from "@/components/ui/Segmented";
import { ValorCampo, VALOR_VAZIO, lerValor, type ValorEstado } from "@/components/financas/ValorCampo";
import { totalCabecas } from "@/lib/composicao";
import { marcarNascidoNaFazenda, registrarCustoAquisicao } from "@/lib/financas";
import type { LoteGado } from "@/lib/types";
import { hoje } from "@/lib/utils";

const OPCOES = ["Comprei", "Nasceu aqui"] as const;
type Opcao = (typeof OPCOES)[number];

/** Informa o preço pago pelo gado que já estava no lote (ou marca que nasceu na fazenda). */
export function PrecoCompraSheet({ open, lote, onClose }: { open: boolean; lote: LoteGado; onClose: () => void }) {
  const total = totalCabecas(lote.composicao);
  const [opcao, setOpcao] = useState<Opcao>("Comprei");
  const [valor, setValor] = useState<ValorEstado>(VALOR_VAZIO);
  const [data, setData] = useState("");
  const [cabecas, setCabecas] = useState(String(total));
  const [vendedor, setVendedor] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOpcao("Comprei");
    setValor(VALOR_VAZIO);
    setData("");
    setCabecas(String(totalCabecas(lote.composicao)));
    setVendedor("");
    setErro("");
    setSalvando(false);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = Math.floor(Number(cabecas)) || 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      if (opcao === "Nasceu aqui") {
        await marcarNascidoNaFazenda(lote.id, true);
      } else {
        const v = lerValor(valor);
        if (typeof v === "string") throw new Error(v);
        await registrarCustoAquisicao({ loteId: lote.id, data, valor: v, cabecas: n, vendedor });
      }
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Preço de compra"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-preco-compra" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <form id="form-preco-compra" noValidate onSubmit={salvar} className="space-y-5 pt-1">
        <Erro texto={erro} />
        <p className="text-sm text-dark/70">
          Lote <strong>{lote.nome}</strong> · {total} {total === 1 ? "cabeça" : "cabeças"}
        </p>
        <Segmented label="Como esse gado chegou" value={opcao} options={OPCOES} onChange={setOpcao} />

        {opcao === "Nasceu aqui" ? (
          <p className="rounded-xl bg-brand-50 p-3 text-sm text-dark/70">
            Gado nascido na fazenda não tem preço de compra. O custo dele conta como zero e o lote deixa de aparecer como &quot;sem preço&quot;.
          </p>
        ) : (
          <>
            <ValorCampo valor={valor} onChange={setValor} cabecas={n} idBase="pc" />
            <div>
              <label htmlFor="pc-cabecas" className="field-label">
                Cabeças que esse valor cobre
              </label>
              <input id="pc-cabecas" type="number" inputMode="numeric" min={1} max={total} className="field" value={cabecas} onChange={(e) => setCabecas(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pc-data" className="field-label">
                Data da compra (pode ser aproximada) <span className="text-red-600">*</span>
              </label>
              <input id="pc-data" type="date" className="field" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
              <p className="mt-1 text-xs text-dark/55">O valor aparece em Finanças como saída nesta data.</p>
            </div>
            <div>
              <label htmlFor="pc-vendedor" className="field-label">
                Comprado de (opcional)
              </label>
              <input id="pc-vendedor" className="field" value={vendedor} onChange={(e) => setVendedor(e.target.value)} maxLength={80} />
            </div>
          </>
        )}
      </form>
    </BottomSheet>
  );
}
