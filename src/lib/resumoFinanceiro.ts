import { CAT_ALUGUEL, parcelasDeAluguel } from "./aluguel";
import type { CompraRecurso, Movimentacao, Pasto, Recurso, UsoRecurso } from "./types";
import { hoje } from "./utils";

// Funções puras (sem banco) que somam o dinheiro por período, categoria e pasto.

export const CAT_GADO = "Compra de gado";
export const CAT_SUPLEMENTO = "Sal e suplementos";
export const CAT_REMEDIO = "Remédios";

export interface DadosFinanceiros {
  movimentacoes: Pick<Movimentacao, "id" | "tipo" | "data" | "valor" | "categoria" | "pastoId" | "deletedAt">[];
  comprasRecurso: Pick<CompraRecurso, "recursoId" | "data" | "total" | "quantidade" | "createdAt" | "deletedAt">[];
  usosRecurso: Pick<UsoRecurso, "recursoId" | "pastoId" | "data" | "custo" | "deletedAt">[];
  /** Todos os itens de estoque, inclusive excluídos (só para saber se é suplemento ou remédio). */
  recursos: Pick<Recurso, "id" | "tipo" | "nome">[];
  /** Pastos (para o aluguel mensal). */
  pastos?: Pick<Pasto, "id" | "nome" | "aluguel" | "deletedAt">[];
}

export interface Filtro {
  ano: number;
  /** 1 a 12; null = o ano todo. */
  mes: number | null;
  /** Só um pasto; null = todos. */
  pastoId: string | null;
}

export interface Lancamento {
  chave: string;
  data: string;
  /** Entrada soma ao caixa; saída subtrai. */
  entrada: boolean;
  valor: number;
  categoria: string;
}

const noPeriodo = (data: string, f: Filtro) => {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  return ano === f.ano && (f.mes === null || mes === f.mes);
};

/**
 * Transforma tudo em lançamentos de caixa. Sem filtro de pasto: vendas (entradas) e compras de gado,
 * despesas e compras de estoque (saídas). Com pasto: vendas, compras e despesas daquele pasto mais o
 * custo do sal e do remédio gastos nele (as compras de estoque não pertencem a um pasto).
 */
export function lancamentos(d: DadosFinanceiros, f: Filtro, hojeIso: string = hoje()): Lancamento[] {
  const tipoDe = new Map(d.recursos.map((r) => [r.id, r.tipo]));
  const lista: Lancamento[] = [];

  for (const m of d.movimentacoes) {
    if (m.deletedAt || !noPeriodo(m.data, f)) continue;
    if (f.pastoId && m.pastoId !== f.pastoId) continue;
    lista.push({
      chave: m.id,
      data: m.data,
      entrada: m.tipo === "Venda",
      valor: m.valor,
      categoria: m.tipo === "Venda" ? "Venda de gado" : m.tipo === "Compra" ? CAT_GADO : m.categoria,
    });
  }

  for (const a of parcelasDeAluguel(d.pastos ?? [], hojeIso)) {
    if (!noPeriodo(a.data, f) || (f.pastoId && a.pastoId !== f.pastoId)) continue;
    lista.push({ chave: `aluguel:${a.pastoId}:${a.data}`, data: a.data, entrada: false, valor: a.valor, categoria: CAT_ALUGUEL });
  }

  if (!f.pastoId) {
    for (const c of d.comprasRecurso) {
      if (c.deletedAt || c.total === null || !noPeriodo(c.data, f)) continue;
      lista.push({
        chave: `estoque:${c.recursoId}:${c.data}:${c.total}`,
        data: c.data,
        entrada: false,
        valor: c.total,
        categoria: tipoDe.get(c.recursoId) === "Remédio" ? CAT_REMEDIO : CAT_SUPLEMENTO,
      });
    }
  } else {
    for (const u of d.usosRecurso) {
      if (u.deletedAt || u.custo === null || u.pastoId !== f.pastoId || !noPeriodo(u.data, f)) continue;
      lista.push({
        chave: `uso:${u.recursoId}:${u.data}:${u.custo}`,
        data: u.data,
        entrada: false,
        valor: u.custo,
        categoria: tipoDe.get(u.recursoId) === "Remédio" ? CAT_REMEDIO : CAT_SUPLEMENTO,
      });
    }
  }
  return lista;
}

const reais = (n: number) => Math.round(n * 100) / 100;

export interface Resumo {
  entradas: number;
  saidas: number;
  saldo: number;
}

export function totais(l: Lancamento[]): Resumo {
  const entradas = reais(l.filter((x) => x.entrada).reduce((s, x) => s + x.valor, 0));
  const saidas = reais(l.filter((x) => !x.entrada).reduce((s, x) => s + x.valor, 0));
  return { entradas, saidas, saldo: reais(entradas - saidas) };
}

/** 12 posições (janeiro a dezembro) com o que entrou e o que saiu em cada mês. */
export function porMes(l: Lancamento[]): { mes: number; entradas: number; saidas: number }[] {
  const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, entradas: 0, saidas: 0 }));
  for (const x of l) {
    const m = meses[Number(x.data.slice(5, 7)) - 1];
    if (x.entrada) m.entradas = reais(m.entradas + x.valor);
    else m.saidas = reais(m.saidas + x.valor);
  }
  return meses;
}

/** Saídas por categoria, da maior para a menor. */
export function saidasPorCategoria(l: Lancamento[]): { categoria: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const x of l) if (!x.entrada) mapa.set(x.categoria, reais((mapa.get(x.categoria) ?? 0) + x.valor));
  return Array.from(mapa, ([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
}

/**
 * Custo de cada pasto no período: despesas ligadas a ele mais o sal e o remédio gastos nele.
 * (Compra e venda de gado não entram: não são custo do pasto.) Ignora o filtro de pasto.
 */
export function custoPorPasto(d: DadosFinanceiros, f: Omit<Filtro, "pastoId">, hojeIso: string = hoje()): { pastoId: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const m of d.movimentacoes) {
    if (m.deletedAt || m.tipo !== "Despesa" || !m.pastoId || !noPeriodo(m.data, { ...f, pastoId: null })) continue;
    mapa.set(m.pastoId, (mapa.get(m.pastoId) ?? 0) + m.valor);
  }
  for (const a of parcelasDeAluguel(d.pastos ?? [], hojeIso)) {
    if (!noPeriodo(a.data, { ...f, pastoId: null })) continue;
    mapa.set(a.pastoId, (mapa.get(a.pastoId) ?? 0) + a.valor);
  }
  for (const u of d.usosRecurso) {
    if (u.deletedAt || u.custo === null || !noPeriodo(u.data, { ...f, pastoId: null })) continue;
    mapa.set(u.pastoId, (mapa.get(u.pastoId) ?? 0) + u.custo);
  }
  return Array.from(mapa, ([pastoId, valor]) => ({ pastoId, valor: reais(valor) })).sort((a, b) => b.valor - a.valor);
}
