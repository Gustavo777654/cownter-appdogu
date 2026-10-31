"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { reporEstoque, UNIDADE } from "@/lib/recursos";
import type { Recurso } from "@/lib/types";
import { hoje } from "@/lib/utils";
import { lerNumero, textoNumero } from "./campos";

export function ReporSheet({ open, recurso, onClose }: { open: boolean; recurso: Recurso; onClose: () => void }) {
  const un = UNIDADE[recurso.tipo];
  const [data, setData] = useState(hoje());
  const [qtd, setQtd] = useState("");
  const [preco, setPreco] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setData(hoje());
    setQtd("");
    setPreco(textoNumero(recurso.precoUnitario));
    setErro("");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const q = lerNumero(qtd);
    const p = lerNumero(preco);
    if (q === null || Number.isNaN(q) || (p !== null && Number.isNaN(p))) {
      setErro("Informe a quantidade comprada (use vírgula para decimal).");
      return;
    }
    setSalvando(true);
    try {
      await reporEstoque(recurso.id, { data, quantidade: q, precoUnitario: p });
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível repor.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Repor ${recurso.nome}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-repor" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : "Repor estoque"}
          </button>
        </div>
      }
    >
      <form id="form-repor" noValidate onSubmit={salvar} className="space-y-5 pt-1">
        <Erro texto={erro} />
        <div>
          <label htmlFor="rp-qtd" className="field-label">
            Quantos {un.plural} comprou
          </label>
          <input id="rp-qtd" className="field" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Ex: 10" />
        </div>
        <div>
          <label htmlFor="rp-preco" className="field-label">
            Preço de cada {un.singular} (R$)
          </label>
          <input id="rp-preco" className="field" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rp-data" className="field-label">
            Data da compra
          </label>
          <input id="rp-data" type="date" className="field" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        </div>
        <p className="text-sm text-dark/60">A compra fica guardada no histórico e depois entra como despesa em Finanças.</p>
      </form>
    </BottomSheet>
  );
}
