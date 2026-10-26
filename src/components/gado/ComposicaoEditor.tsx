"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { totalCabecas } from "@/lib/composicao";
import { CATEGORIAS, SEXOS, type LinhaComposicao, type Sexo } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Linha em edição: a quantidade fica como texto para o campo aceitar apagar e digitar. */
export interface LinhaEditavel {
  sexo: Sexo;
  categoria: string;
  quantidade: string;
}

export function linhasParaEditar(linhas: LinhaComposicao[]): LinhaEditavel[] {
  return linhas.map((l) => ({ ...l, quantidade: String(l.quantidade) }));
}

export function linhasParaSalvar(linhas: LinhaEditavel[]): LinhaComposicao[] {
  return linhas.map((l) => ({
    sexo: l.sexo,
    categoria: l.categoria,
    quantidade: l.quantidade.trim() === "" ? 0 : Number(l.quantidade),
  }));
}

export const LINHA_NOVA: LinhaEditavel = { sexo: "Fêmea", categoria: CATEGORIAS.Fêmea[0], quantidade: "" };

interface ComposicaoEditorProps {
  linhas: LinhaEditavel[];
  onChange: (linhas: LinhaEditavel[]) => void;
}

/**
 * Composição do lote: primeiro o sexo, depois a categoria daquele sexo e a quantidade.
 * Lote misto = mais de uma linha.
 */
export function ComposicaoEditor({ linhas, onChange }: ComposicaoEditorProps) {
  const alterar = (i: number, parcial: Partial<LinhaEditavel>) =>
    onChange(linhas.map((l, idx) => (idx === i ? { ...l, ...parcial } : l)));

  const trocarSexo = (i: number, sexo: Sexo) => {
    const atual = linhas[i];
    if (atual.sexo === sexo) return;
    alterar(i, { sexo, categoria: CATEGORIAS[sexo][0] });
  };

  const total = totalCabecas(linhasParaSalvar(linhas).filter((l) => Number.isInteger(l.quantidade)));

  return (
    <div className="space-y-3">
      {linhas.map((l, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-brand-100 bg-white p-3">
          <fieldset>
            <legend className="field-label">Sexo</legend>
            <div className="grid grid-cols-2 gap-2">
              {SEXOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => trocarSexo(i, s)}
                  aria-pressed={l.sexo === s}
                  className={cn(
                    "h-11 rounded-xl border text-base font-semibold transition-colors",
                    l.sexo === s
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-brand-200 bg-white text-dark/70"
                  )}
                >
                  {s === "Fêmea" ? "Fêmeas" : "Machos"}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={`comp-cat-${i}`} className="field-label">
                Categoria
              </label>
              <select
                id={`comp-cat-${i}`}
                className="field"
                value={l.categoria}
                onChange={(e) => alterar(i, { categoria: e.target.value })}
              >
                {CATEGORIAS[l.sexo].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24 shrink-0">
              <label htmlFor={`comp-qtd-${i}`} className="field-label">
                Cabeças
              </label>
              <input
                id={`comp-qtd-${i}`}
                className="field px-3 text-center"
                inputMode="numeric"
                value={l.quantidade}
                onChange={(e) => alterar(i, { quantidade: e.target.value.replace(/\D/g, "") })}
                placeholder="0"
                autoComplete="off"
              />
            </div>
            {linhas.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(linhas.filter((_, idx) => idx !== i))}
                aria-label="Remover linha"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash size={20} />
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...linhas, { ...LINHA_NOVA }])}
        className="btn-secondary min-h-11 w-full text-sm"
      >
        <Plus size={18} weight="bold" />
        Adicionar outra categoria (lote misto)
      </button>

      <p className="text-sm font-semibold text-dark/70">
        Total do lote: <span className="text-brand-700">{total}</span> {total === 1 ? "cabeça" : "cabeças"}
      </p>
    </div>
  );
}
