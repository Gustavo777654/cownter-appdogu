"use client";

import { Segmented } from "@/components/ui/Segmented";
import { lerNumero, lerReais } from "@/components/recursos/campos";
import { formatarReais } from "@/lib/recursos";
import type { ValorInput } from "@/lib/financas";

export const MODOS_VALOR = ["Total", "Por cabeça", "Por arroba"] as const;
export type ModoValor = (typeof MODOS_VALOR)[number];

export interface ValorEstado {
  modo: ModoValor;
  a: string; // total | por cabeça | preço da arroba
  b: string; // total de arrobas
}

export const VALOR_VAZIO: ValorEstado = { modo: "Total", a: "", b: "" };

/** Converte o que foi digitado em ValorInput; devolve texto de erro se não der. */
export function lerValor(v: ValorEstado): ValorInput | string {
  const a = lerReais(v.a);
  if (a === null || Number.isNaN(a)) return v.modo === "Por arroba" ? "Informe o preço da arroba." : "Informe o valor (use números; vírgula para centavos).";
  if (v.modo === "Total") return { modo: "total", total: a };
  if (v.modo === "Por cabeça") return { modo: "cabeca", porCabeca: a };
  const b = lerNumero(v.b);
  if (b === null || Number.isNaN(b)) return "Informe o total de arrobas.";
  return { modo: "arroba", precoArroba: a, arrobas: b };
}

/** Valor em R$: total, por cabeça ou por arroba (preço da @ × total de @), com o total calculado embaixo. */
export function ValorCampo({
  valor,
  onChange,
  cabecas,
  idBase,
}: {
  valor: ValorEstado;
  onChange: (v: ValorEstado) => void;
  cabecas: number;
  idBase: string;
}) {
  const lido = lerValor(valor);
  let total: number | null = null;
  if (typeof lido !== "string") {
    total = lido.modo === "total" ? lido.total : lido.modo === "cabeca" ? lido.porCabeca * cabecas : lido.precoArroba * lido.arrobas;
  }

  return (
    <div className="space-y-3">
      <Segmented label="Como informar o valor" value={valor.modo} options={MODOS_VALOR} onChange={(modo) => onChange({ ...valor, modo })} />
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${idBase}-a`} className="field-label">
            {valor.modo === "Total" ? "Valor total (R$)" : valor.modo === "Por cabeça" ? "Valor de cada cabeça (R$)" : "Preço da arroba (R$)"}
          </label>
          <input id={`${idBase}-a`} className="field" inputMode="decimal" value={valor.a} onChange={(e) => onChange({ ...valor, a: e.target.value })} placeholder="Ex: 3.500,00" />
        </div>
        {valor.modo === "Por arroba" && (
          <div className="w-32 shrink-0">
            <label htmlFor={`${idBase}-b`} className="field-label">
              Total de @
            </label>
            <input id={`${idBase}-b`} className="field" inputMode="decimal" value={valor.b} onChange={(e) => onChange({ ...valor, b: e.target.value })} placeholder="Ex: 36" />
          </div>
        )}
      </div>
      {total !== null && (
        <p className="text-sm text-dark/70">
          Total: <strong>{formatarReais(total)}</strong>
          {cabecas > 0 && ` · ${formatarReais(total / cabecas)} por cabeça`}
        </p>
      )}
    </div>
  );
}
