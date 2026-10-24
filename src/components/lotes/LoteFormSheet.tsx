"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { atualizarLote, criarLote } from "@/lib/lotes";
import { NIVEIS_PASTO, type Lote, type NivelPasto } from "@/lib/types";
import { COR_NIVEL_SELECIONADO } from "./nivel";

interface LoteFormSheetProps {
  open: boolean;
  /** Quando informado, edita este pasto; senão cria um novo. */
  lote?: Lote | null;
  onClose: () => void;
  /** Chamado depois de criar um pasto novo, com o pasto criado. */
  onCreated?: (lote: Lote) => void;
}

export function LoteFormSheet({ open, lote, onClose, onCreated }: LoteFormSheetProps) {
  const editando = !!lote;
  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [nivel, setNivel] = useState<NivelPasto>("Alto");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(lote?.nome ?? "");
    setArea(lote?.areaHa != null ? String(lote.areaHa).replace(".", ",") : "");
    setNivel(lote?.nivelPasto ?? "Alto");
    setErro("");
    setSalvando(false);
  }, [open, lote]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    let areaHa: number | null = null;
    if (area.trim()) {
      areaHa = Number(area.replace(",", "."));
      if (!Number.isFinite(areaHa) || areaHa <= 0) {
        setErro("Área inválida. Use um valor em hectares, por exemplo 15,5.");
        return;
      }
    }

    setSalvando(true);
    try {
      const dados = { nome, areaHa, nivelPasto: nivel };
      if (lote) {
        await atualizarLote(lote.id, dados);
        onClose();
      } else {
        const criado = await criarLote(dados);
        onClose();
        onCreated?.(criado);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editando ? "Editar pasto" : "Novo pasto"}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-lote" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : editando ? "Salvar" : "Criar pasto"}
          </button>
        </div>
      }
    >
      <form id="form-lote" onSubmit={salvar} className="space-y-4 pt-1">
        {erro && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"
          >
            <Warning size={20} weight="fill" className="mt-0.5 shrink-0" />
            {erro}
          </div>
        )}

        <div>
          <label htmlFor="lote-nome" className="field-label">
            Nome do pasto <span className="text-red-600">*</span>
          </label>
          <input
            id="lote-nome"
            className="field"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Pasto Norte"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label htmlFor="lote-area" className="field-label">
            Área em hectares (opcional)
          </label>
          <input
            id="lote-area"
            className="field"
            inputMode="decimal"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Ex: 15,5"
          />
        </div>

        <div>
          <Segmented
            label="Nível do pasto (quantidade de capim)"
            value={nivel}
            options={NIVEIS_PASTO}
            onChange={setNivel}
            cores={COR_NIVEL_SELECIONADO}
          />
          <p className="mt-1.5 text-xs text-dark/55">
            Alto: muito capim. Médio: capim razoável. Baixo: pouco capim, precisa descansar.
          </p>
        </div>
      </form>
    </BottomSheet>
  );
}
