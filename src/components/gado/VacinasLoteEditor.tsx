"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { cn, hoje } from "@/lib/utils";

const SUGESTOES = [
  "Aftosa",
  "Brucelose",
  "Raiva",
  "Clostridioses",
  "Carbúnculo sintomático",
  "IBR/BVD",
  "Leptospirose",
];

/** Vacina em edição: "faltam" fica como texto para o campo aceitar apagar e digitar. */
export interface VacinaEditavel {
  nome: string;
  aplicada: boolean;
  faltam: string;
  data: string;
}

interface VacinasLoteEditorProps {
  vacinas: VacinaEditavel[];
  onChange: (vacinas: VacinaEditavel[]) => void;
}

/** Vacinas do lote: nome, se foi aplicada, quantas cabeças faltam e a data. Tudo opcional. */
export function VacinasLoteEditor({ vacinas, onChange }: VacinasLoteEditorProps) {
  const alterar = (i: number, parcial: Partial<VacinaEditavel>) =>
    onChange(vacinas.map((v, idx) => (idx === i ? { ...v, ...parcial } : v)));

  return (
    <div className="space-y-3">
      {vacinas.map((v, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-brand-100 bg-white p-3">
          <div>
            <label htmlFor={`vacina-nome-${i}`} className="field-label">
              Vacina
            </label>
            <input
              id={`vacina-nome-${i}`}
              className="field"
              list="vacinas-sugestoes"
              value={v.nome}
              onChange={(e) => alterar(i, { nome: e.target.value })}
              placeholder="Ex: Aftosa"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { valor: true, rotulo: "Aplicada" },
              { valor: false, rotulo: "Não aplicada" },
            ].map((op) => (
              <button
                key={op.rotulo}
                type="button"
                onClick={() => alterar(i, { aplicada: op.valor })}
                aria-pressed={v.aplicada === op.valor}
                className={cn(
                  "h-11 rounded-xl border text-sm font-semibold transition-colors",
                  v.aplicada === op.valor
                    ? op.valor
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-amber-500 bg-amber-500 text-white"
                    : "border-brand-200 bg-white text-dark/70"
                )}
              >
                {op.rotulo}
              </button>
            ))}
          </div>

          {v.aplicada && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor={`vacina-data-${i}`} className="field-label">
                  Data (se lembrar)
                </label>
                <input
                  id={`vacina-data-${i}`}
                  type="date"
                  className="field"
                  value={v.data}
                  max={hoje()}
                  onChange={(e) => alterar(i, { data: e.target.value })}
                />
              </div>
              <div className="w-28 shrink-0">
                <label htmlFor={`vacina-faltam-${i}`} className="field-label">
                  Faltam
                </label>
                <input
                  id={`vacina-faltam-${i}`}
                  className="field px-3 text-center"
                  inputMode="numeric"
                  value={v.faltam}
                  onChange={(e) => alterar(i, { faltam: e.target.value.replace(/\D/g, "") })}
                  placeholder="0"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onChange(vacinas.filter((_, idx) => idx !== i))}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-600"
          >
            <Trash size={16} />
            Remover vacina
          </button>
        </div>
      ))}

      <datalist id="vacinas-sugestoes">
        {SUGESTOES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <button
        type="button"
        onClick={() => onChange([...vacinas, { nome: "", aplicada: true, faltam: "", data: "" }])}
        className="btn-secondary min-h-11 w-full text-sm"
      >
        <Plus size={18} weight="bold" />
        Adicionar vacina
      </button>
    </div>
  );
}
