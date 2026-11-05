"use client";

import { useState } from "react";
import { formatarReais } from "@/lib/recursos";
import { cn } from "@/lib/utils";

// Cores validadas (azul x laranja separam bem inclusive para daltonismo).
export const COR_ENTRADA = "#2a78d6";
export const COR_SAIDA = "#eb6834";

export const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "R$ 12,5 mil" para os eixos; valores pequenos ficam inteiros. */
export function compacto(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
}

/** Topo "redondo" do eixo (1, 2, 2,5, 5 × 10^n) acima do maior valor. */
function topoDoEixo(maximo: number): number {
  if (maximo <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(maximo)));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * exp >= maximo) return f * exp;
  return 10 * exp;
}

interface DadoMes {
  mes: number;
  entradas: number;
  saidas: number;
}

/** Barras agrupadas: o que entrou (azul) e o que saiu (laranja) em cada mês. Toque em um mês para ver os valores. */
export function GraficoMeses({ dados }: { dados: DadoMes[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);
  const W = 340;
  const H = 190;
  const ml = 58;
  const mb = 22;
  const mt = 8;
  const topo = topoDoEixo(Math.max(...dados.flatMap((d) => [d.entradas, d.saidas])));
  const area = H - mt - mb;
  const passo = (W - ml) / 12;
  const larg = Math.min(11, passo / 2 - 2);
  const y = (v: number) => mt + area - (v / topo) * area;
  const ticks = [0, topo / 2, topo];
  const vazio = dados.every((d) => d.entradas === 0 && d.saidas === 0);
  const atual = sel !== null ? dados[sel] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dark/70">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COR_ENTRADA }} />
          Entrou (vendas)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COR_SAIDA }} />
          Saiu (compras e despesas)
        </span>
      </div>

      {tabela ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-dark/60">
              <th className="py-1 font-semibold">Mês</th>
              <th className="py-1 text-right font-semibold">Entrou</th>
              <th className="py-1 text-right font-semibold">Saiu</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.mes} className="border-t border-brand-100">
                <td className="py-1">{MESES_ABREV[d.mes - 1]}</td>
                <td className="py-1 text-right">{formatarReais(d.entradas)}</td>
                <td className="py-1 text-right">{formatarReais(d.saidas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Entradas e saídas por mês">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={ml} x2={W} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={ml - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#6b7280">
                {t === 0 ? "0" : compacto(t)}
              </text>
            </g>
          ))}
          {dados.map((d, i) => {
            const x0 = ml + i * passo + passo / 2;
            const ativo = sel === i;
            const altE = (d.entradas / topo) * area;
            const altS = (d.saidas / topo) * area;
            return (
              <g key={d.mes} onClick={() => setSel(ativo ? null : i)} style={{ cursor: "pointer" }}>
                <rect x={ml + i * passo} y={mt} width={passo} height={area + mb} fill={ativo ? "#f0fdf4" : "transparent"} />
                {d.entradas > 0 && <rect x={x0 - larg - 1} y={y(d.entradas)} width={larg} height={Math.max(altE, 1)} rx={3} fill={COR_ENTRADA} />}
                {d.saidas > 0 && <rect x={x0 + 1} y={y(d.saidas)} width={larg} height={Math.max(altS, 1)} rx={3} fill={COR_SAIDA} />}
                <text x={x0} y={H - 6} textAnchor="middle" fontSize={9.5} fill={ativo ? "#1f2937" : "#6b7280"} fontWeight={ativo ? 700 : 400}>
                  {MESES_ABREV[i]}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {!tabela && (
        <p className="mt-1 min-h-10 text-sm text-dark/70" aria-live="polite">
          {vazio
            ? "Nenhum lançamento neste período."
            : atual
              ? `${MESES_ABREV[atual.mes - 1]}: entrou ${formatarReais(atual.entradas)} · saiu ${formatarReais(atual.saidas)}`
              : "Toque em um mês para ver os valores."}
        </p>
      )}

      <button type="button" onClick={() => setTabela((v) => !v)} className="text-sm font-semibold text-brand-700">
        {tabela ? "Ver gráfico" : "Ver em tabela"}
      </button>
    </div>
  );
}

/** Barras horizontais de uma série (uma categoria por linha), com o valor escrito ao lado. */
export function BarrasHorizontais({ itens, cor = COR_SAIDA, vazio }: { itens: { rotulo: string; valor: number }[]; cor?: string; vazio: string }) {
  if (itens.length === 0) return <p className="text-sm text-dark/60">{vazio}</p>;
  const max = Math.max(...itens.map((i) => i.valor));
  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-dark">{i.rotulo}</span>
            <span className="shrink-0 text-dark/70">{formatarReais(i.valor)}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-brand-50">
            <div className={cn("h-2.5 rounded-full")} style={{ width: `${Math.max(2, (i.valor / max) * 100)}%`, background: cor }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
