import type { LoteGado, Movimentacao } from "./types";

// Funções puras sobre o preço de compra do gado (sem banco).

export interface CustoLote {
  /** Total pago (soma das compras do lote). */
  valor: number;
  /** Cabeças cobertas por essas compras. */
  cabecas: number;
  /** Custo médio por cabeça. */
  porCabeca: number;
}

type MovCompra = Pick<Movimentacao, "tipo" | "loteGadoId" | "valor" | "cabecas" | "deletedAt">;

export type StatusPreco = "comprado" | "nascido" | "sem";

const reais = (n: number) => Math.round(n * 100) / 100;

/** Soma as compras de cada lote (ignora excluídas e as sem lote). */
export function custosPorLote(movs: MovCompra[]): Map<string, CustoLote> {
  const mapa = new Map<string, CustoLote>();
  for (const m of movs) {
    if (m.deletedAt || m.tipo !== "Compra" || !m.loteGadoId || m.cabecas <= 0) continue;
    const a = mapa.get(m.loteGadoId) ?? { valor: 0, cabecas: 0, porCabeca: 0 };
    a.valor = reais(a.valor + m.valor);
    a.cabecas += m.cabecas;
    a.porCabeca = a.valor / a.cabecas;
    mapa.set(m.loteGadoId, a);
  }
  return mapa;
}

export function statusPreco(lote: Pick<LoteGado, "id" | "nascidoNaFazenda">, custos: Map<string, CustoLote>): StatusPreco {
  if (custos.has(lote.id)) return "comprado";
  return lote.nascidoNaFazenda ? "nascido" : "sem";
}

export function lotesSemPreco<T extends Pick<LoteGado, "id" | "nascidoNaFazenda" | "deletedAt">>(lotes: T[], movs: MovCompra[]): T[] {
  const custos = custosPorLote(movs);
  return lotes.filter((l) => !l.deletedAt && statusPreco(l, custos) === "sem");
}

export interface ResultadoVenda {
  receita: number;
  /** null = o lote não tem preço de compra (ou nasceu na fazenda, custo 0 é informado como 0). */
  custo: number | null;
  lucro: number | null;
}

/**
 * Resultado de uma venda: receita menos o custo médio por cabeça do lote vezes as cabeças vendidas.
 * Lote nascido na fazenda tem custo 0; lote sem preço devolve custo e lucro null.
 */
export function resultadoDaVenda(
  venda: Pick<Movimentacao, "valor" | "cabecas" | "loteGadoId">,
  lotes: Pick<LoteGado, "id" | "nascidoNaFazenda">[],
  custos: Map<string, CustoLote>
): ResultadoVenda {
  const receita = venda.valor;
  const lote = venda.loteGadoId ? lotes.find((l) => l.id === venda.loteGadoId) : undefined;
  const c = venda.loteGadoId ? custos.get(venda.loteGadoId) : undefined;
  if (c) {
    const custo = reais(Math.min(c.porCabeca * venda.cabecas, Number.MAX_SAFE_INTEGER));
    return { receita, custo, lucro: reais(receita - custo) };
  }
  if (lote?.nascidoNaFazenda) return { receita, custo: 0, lucro: receita };
  return { receita, custo: null, lucro: null };
}

export interface ResultadoVendas {
  /** Receita só das vendas que têm custo conhecido. */
  receita: number;
  custo: number;
  lucro: number;
  /** Vendas deixadas de fora por não terem preço de compra. */
  semPreco: number;
}

/** Soma o resultado de várias vendas; as de lote sem preço ficam de fora e são contadas. */
export function resultadoDasVendas(
  vendas: Pick<Movimentacao, "valor" | "cabecas" | "loteGadoId">[],
  lotes: Pick<LoteGado, "id" | "nascidoNaFazenda">[],
  custos: Map<string, CustoLote>
): ResultadoVendas {
  let receita = 0;
  let custo = 0;
  let semPreco = 0;
  for (const v of vendas) {
    const r = resultadoDaVenda(v, lotes, custos);
    if (r.custo === null) semPreco++;
    else {
      receita += r.receita;
      custo += r.custo;
    }
  }
  return { receita: reais(receita), custo: reais(custo), lucro: reais(receita - custo), semPreco };
}
