"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Erro } from "@/components/ui/Erro";
import { atualizarRecurso, criarRecurso, UNIDADE } from "@/lib/recursos";
import type { Recurso, TipoRecurso } from "@/lib/types";
import { lerNumero, textoNumero } from "./campos";

interface Props {
  open: boolean;
  tipo: TipoRecurso;
  /** Quando informado, edita este item; senão cadastra um novo. */
  recurso?: Recurso | null;
  onClose: () => void;
  onCreated?: (recurso: Recurso) => void;
}

export function RecursoFormSheet({ open, tipo, recurso, onClose, onCreated }: Props) {
  const editando = !!recurso;
  const suplemento = tipo === "Suplemento";
  const un = UNIDADE[tipo];

  const [nome, setNome] = useState("");
  const [kg, setKg] = useState("");
  const [preco, setPreco] = useState("");
  const [estoque, setEstoque] = useState("");
  const [minimo, setMinimo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(recurso?.nome ?? "");
    setKg(textoNumero(recurso?.kgPorSaco));
    setPreco(textoNumero(recurso?.precoUnitario));
    setEstoque("");
    setMinimo(textoNumero(recurso?.estoqueMinimo));
    setErro("");
    setSalvando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recurso?.id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const dados = {
      tipo,
      nome,
      kgPorSaco: lerNumero(kg),
      precoUnitario: lerNumero(preco),
      estoqueMinimo: lerNumero(minimo),
    };
    const qtd = lerNumero(estoque);
    if ([dados.kgPorSaco, dados.precoUnitario, dados.estoqueMinimo, qtd].some((n) => n !== null && Number.isNaN(n))) {
      setErro("Use só números nos valores. Para decimal, pode usar vírgula (ex.: 2,5).");
      return;
    }
    setSalvando(true);
    try {
      if (recurso) {
        await atualizarRecurso(recurso.id, dados);
        onClose();
      } else {
        const criado = await criarRecurso(dados, qtd);
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
      title={editando ? `Editar ${tipo === "Suplemento" ? "suplemento" : "remédio"}` : `Novo ${tipo === "Suplemento" ? "suplemento" : "remédio"}`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" form="form-recurso" disabled={salvando} className="btn-primary flex-1">
            {salvando ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      }
    >
      <form id="form-recurso" noValidate onSubmit={salvar} className="space-y-5 pt-1">
        <Erro texto={erro} />

        <div>
          <label htmlFor="rc-nome" className="field-label">
            Nome <span className="text-red-600">*</span>
          </label>
          <input
            id="rc-nome"
            className="field"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={suplemento ? "Ex: Sal mineral" : "Ex: Ripercol"}
            autoComplete="off"
          />
        </div>

        {suplemento && (
          <div>
            <label htmlFor="rc-kg" className="field-label">
              Quantos kg tem cada saco <span className="text-red-600">*</span>
            </label>
            <input id="rc-kg" className="field" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="Ex: 25" />
          </div>
        )}

        <div>
          <label htmlFor="rc-preco" className="field-label">
            Preço de cada {un.singular} (R$)
          </label>
          <input id="rc-preco" className="field" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="Ex: 95,90" />
        </div>

        {!editando && (
          <div>
            <label htmlFor="rc-estoque" className="field-label">
              Quantos {un.plural} você tem agora
            </label>
            <input id="rc-estoque" className="field" inputMode="decimal" value={estoque} onChange={(e) => setEstoque(e.target.value)} placeholder="Ex: 10" />
            <p className="mt-1.5 text-xs text-dark/55">Entra no estoque como a primeira compra.</p>
          </div>
        )}

        <div>
          <label htmlFor="rc-min" className="field-label">
            Avisar quando restar menos de (opcional)
          </label>
          <input id="rc-min" className="field" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder={`Ex: 3 ${un.plural}`} />
        </div>
      </form>
    </BottomSheet>
  );
}
