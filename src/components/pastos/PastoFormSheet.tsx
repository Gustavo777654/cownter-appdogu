"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Segmented";
import { atualizarPasto, criarPasto } from "@/lib/pastos";
import { NIVEIS_PASTO, type Pasto, type NivelPasto } from "@/lib/types";
import { COR_NIVEL_SELECIONADO } from "./nivel";

interface PastoFormSheetProps {
  open: boolean;
  /** Quando informado, edita este pasto; senão cria um novo. */
  pasto?: Pasto | null;
  onClose: () => void;
  /** Chamado depois de criar um pasto novo, com o pasto criado. */
  onCreated?: (pasto: Pasto) => void;
}

export function PastoFormSheet({ open, pasto, onClose, onCreated }: PastoFormSheetProps) {
  const editando = !!pasto;
  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [nivel, setNivel] = useState<NivelPasto>("Alto");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(pasto?.nome ?? "");
    setArea(pasto?.areaHa != null ? String(pasto.areaHa).replace(".", ",") : "");
    setNivel(pasto?.nivelPasto ?? "Alto");
    setErro("");
    setSalvando(false);
  }, [open, pasto]);

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
      if (pasto) {
        await atualizarPasto(pasto.id, dados);
        onClose();
      } else {
        const criado = await criarPasto(dados);
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
          <button type="submit" form="form-pasto" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : editando ? "Salvar" : "Criar pasto"}
          </button>
        </div>
      }
    >
      <form id="form-pasto" onSubmit={salvar} className="space-y-4 pt-1">
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
          <label htmlFor="pasto-nome" className="field-label">
            Nome do pasto <span className="text-red-600">*</span>
          </label>
          <input
            id="pasto-nome"
            className="field"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Pasto Norte"
            autoComplete="off"
            required
          />
        </div>

        <div>
          <label htmlFor="pasto-area" className="field-label">
            Área em hectares (opcional)
          </label>
          <input
            id="pasto-area"
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
