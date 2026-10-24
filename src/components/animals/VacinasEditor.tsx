"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import type { VacinaFeita } from "@/lib/types";
import { hoje } from "@/lib/utils";

const SUGESTOES = [
  "Aftosa",
  "Brucelose",
  "Raiva",
  "Clostridioses",
  "Carbúnculo sintomático",
  "IBR/BVD",
  "Leptospirose",
];

interface VacinasEditorProps {
  vacinas: VacinaFeita[];
  onChange: (vacinas: VacinaFeita[]) => void;
}

/** Lista editável das vacinas que o animal já recebeu (nome + data opcional). */
export function VacinasEditor({ vacinas, onChange }: VacinasEditorProps) {
  const alterar = (i: number, campo: keyof VacinaFeita, valor: string) =>
    onChange(vacinas.map((v, idx) => (idx === i ? { ...v, [campo]: valor } : v)));

  return (
    <div className="space-y-3">
      {vacinas.map((v, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-brand-100 bg-white p-3">
          <div>
            <label htmlFor={`vacina-nome-${i}`} className="field-label">
              Vacina
            </label>
            <input
              id={`vacina-nome-${i}`}
              className="field"
              list="vacinas-sugestoes"
              value={v.nome}
              onChange={(e) => alterar(i, "nome", e.target.value)}
              placeholder="Ex: Aftosa"
              autoComplete="off"
            />
          </div>
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
                onChange={(e) => alterar(i, "data", e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(vacinas.filter((_, idx) => idx !== i))}
              aria-label="Remover vacina"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash size={20} />
            </button>
          </div>
        </div>
      ))}

      <datalist id="vacinas-sugestoes">
        {SUGESTOES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <button
        type="button"
        onClick={() => onChange([...vacinas, { nome: "", data: "" }])}
        className="btn-secondary min-h-11 w-full text-sm"
      >
        <Plus size={18} weight="bold" />
        Adicionar vacina
      </button>
    </div>
  );
}
