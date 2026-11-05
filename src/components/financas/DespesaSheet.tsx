"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { lerReais } from "@/components/recursos/campos";
import { registrarDespesa } from "@/lib/financas";
import { usePastos } from "@/lib/hooks";
import { CATEGORIAS_DESPESA } from "@/lib/types";
import { hoje } from "@/lib/utils";

export function DespesaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pastos = usePastos();
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_DESPESA[0]);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje());
  const [pastoId, setPastoId] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescricao("");
    setCategoria(CATEGORIAS_DESPESA[0]);
    setValor("");
    setData(hoje());
    setPastoId("");
    setErro("");
    setSalvando(false);
  }, [open]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const v = lerReais(valor);
    if (v === null || Number.isNaN(v)) {
      setErro("Informe o valor (use números; vírgula para centavos).");
      return;
    }
    setSalvando(true);
    try {
      await registrarDespesa({ descricao, categoria, valor: v, data, pastoId: pastoId || null });
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível lançar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Lançar despesa"
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-despesa" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : "Lançar"}
          </button>
        </div>
      }
    >
      <form id="form-despesa" noValidate onSubmit={salvar} className="space-y-5 pt-1">
        <Erro texto={erro} />
        <div>
          <label htmlFor="ds-desc" className="field-label">
            O que foi <span className="text-red-600">*</span>
          </label>
          <input id="ds-desc" className="field" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Arame farpado" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="ds-cat" className="field-label">
            Categoria
          </label>
          <select id="ds-cat" className="field" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS_DESPESA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ds-valor" className="field-label">
            Valor (R$) <span className="text-red-600">*</span>
          </label>
          <input id="ds-valor" className="field" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex: 450,50" />
        </div>
        <div>
          <label htmlFor="ds-data" className="field-label">
            Data
          </label>
          <input id="ds-data" type="date" className="field" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ds-pasto" className="field-label">
            Ligada a um pasto (opcional)
          </label>
          <select id="ds-pasto" className="field" value={pastoId} onChange={(e) => setPastoId(e.target.value)}>
            <option value="">Nenhum (despesa geral)</option>
            {pastos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </form>
    </BottomSheet>
  );
}
