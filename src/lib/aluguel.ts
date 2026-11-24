import { addDias, addMeses, diasEntre } from "./rotinas";
import type { AluguelPasto, Pasto } from "./types";

// Aluguel de pasto: valor por mês, data de início e quantidade de meses (vazio = 1 mês).
// Cada mês é pago no começo (antecipado) ou no fim do mês. O gasto só entra em Finanças depois de pago.

export const CAT_ALUGUEL = "Aluguel de pasto";
export const JANELA_ALUGUEL_DIAS = 7;

export const mesesDoAluguel = (a: AluguelPasto): number => a.meses ?? 1;

/** Valor mensal que valia na data (considera os reajustes). */
export function valorDaParcela(a: AluguelPasto, data: string): number {
  let valor = a.valorMensal;
  let desde = "";
  for (const r of a.reajustes ?? []) {
    if (r.desde <= data && r.desde >= desde) {
      valor = r.valorMensal;
      desde = r.desde;
    }
  }
  return valor;
}

/** Aplica um novo valor. "inicio" vale para todas as parcelas; senão, só a partir de `desde`. */
export function reajustarAluguel(a: AluguelPasto, novoValor: number, aplicar: "inicio" | { desde: string }): AluguelPasto {
  if (aplicar === "inicio") return { ...a, valorMensal: novoValor, reajustes: [] };
  const antes = (a.reajustes ?? []).filter((r) => r.desde < aplicar.desde);
  return { ...a, reajustes: [...antes, { desde: aplicar.desde, valorMensal: novoValor }] };
}

/** Último dia do aluguel (início + meses, menos 1 dia). */
export function fimDoAluguel(a: AluguelPasto): string | null {
  const depois = addMeses(a.inicio, mesesDoAluguel(a));
  return depois ? addDias(depois, -1) : null;
}

/** Vencimento da parcela k: no começo do mês (antecipado) ou no último dia do mês (final). */
export function vencimentoDaParcela(a: AluguelPasto, k: number): string | null {
  if (a.pagamento === "final") {
    const prox = addMeses(a.inicio, k + 1);
    return prox ? addDias(prox, -1) : null;
  }
  return addMeses(a.inicio, k);
}

/** Soma `meses` ao prazo do aluguel (renovação): o novo prazo continua logo depois do fim do anterior. */
export function renovarAluguel(a: AluguelPasto, meses: number): AluguelPasto {
  if (!Number.isInteger(meses) || meses < 1) throw new Error("Informe por quantos meses (número inteiro, 1 ou mais).");
  const total = mesesDoAluguel(a) + meses;
  if (total > 120) throw new Error("O aluguel não pode passar de 120 meses no total.");
  return { ...a, meses: total };
}

/** Situação de cada parcela mensal do aluguel (do início ao fim, inclusive as futuras). */
export interface StatusParcela {
  indice: number;
  vencimento: string;
  valor: number;
  pagoEm: string | null;
}

export function parcelasDoAluguel(a: AluguelPasto): StatusParcela[] {
  const lista: StatusParcela[] = [];
  for (let k = 0; k < mesesDoAluguel(a); k++) {
    const vencimento = vencimentoDaParcela(a, k);
    if (!vencimento) break;
    lista.push({ indice: k, vencimento, valor: valorDaParcela(a, vencimento), pagoEm: a.pagamentos?.[String(k)] ?? null });
  }
  return lista;
}

/** Parcelas que já venceram (ou vencem hoje) e ainda não foram pagas. */
export function parcelasEmAberto(a: AluguelPasto, hojeIso: string): StatusParcela[] {
  return parcelasDoAluguel(a).filter((p) => p.vencimento <= hojeIso && !p.pagoEm);
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Marca a parcela como paga na data informada (não pode ser no futuro). */
export function registrarPagamento(a: AluguelPasto, indice: number, pagoEm: string, hojeIso: string): AluguelPasto {
  if (!Number.isInteger(indice) || indice < 0 || indice >= mesesDoAluguel(a)) throw new Error("Parcela do aluguel não encontrada.");
  if (!DATA.test(pagoEm)) throw new Error("Informe a data do pagamento.");
  if (pagoEm > hojeIso) throw new Error("A data do pagamento não pode ser no futuro.");
  return { ...a, pagamentos: { ...(a.pagamentos ?? {}), [String(indice)]: pagoEm } };
}

export function desfazerPagamento(a: AluguelPasto, indice: number): AluguelPasto {
  const resto = { ...(a.pagamentos ?? {}) };
  delete resto[String(indice)];
  return { ...a, pagamentos: resto };
}

export interface ParcelaAluguel {
  pastoId: string;
  pastoNome: string;
  /** Número da parcela (0 = primeira). */
  indice: number;
  /** Data em que foi paga: é ela que decide o mês em Finanças. */
  data: string;
  vencimento: string;
  valor: number;
}

export function parcelasDeAluguel(
  pastos: Pick<Pasto, "id" | "nome" | "aluguel" | "deletedAt">[],
  hojeIso: string
): ParcelaAluguel[] {
  const lista: ParcelaAluguel[] = [];
  for (const p of pastos) {
    if (p.deletedAt || !p.aluguel) continue;
    for (const parcela of parcelasDoAluguel(p.aluguel)) {
      if (!parcela.pagoEm || parcela.pagoEm > hojeIso) continue;
      lista.push({ pastoId: p.id, pastoNome: p.nome, indice: parcela.indice, data: parcela.pagoEm, vencimento: parcela.vencimento, valor: parcela.valor });
    }
  }
  return lista;
}

export interface AlertaAluguel {
  chave: string;
  pastoId: string;
  pastoNome: string;
  titulo: string;
  fim: string;
  /** Dias até o fim (negativo = já venceu). Em "pagar": dias desde o vencimento mais antigo em aberto. */
  dias: number;
  tipo: "fim" | "pagar";
  /** Só em "pagar": quantas parcelas estão em aberto. */
  emAberto?: number;
}

/** Aluguéis que terminam em até 7 dias ou já terminaram, e parcelas vencidas ainda não pagas. */
export function coletarAlertasAluguel(
  pastos: Pick<Pasto, "id" | "nome" | "aluguel" | "deletedAt">[],
  hojeIso: string,
  janela: number = JANELA_ALUGUEL_DIAS
): AlertaAluguel[] {
  const alertas: AlertaAluguel[] = [];
  for (const p of pastos) {
    if (p.deletedAt || !p.aluguel) continue;
    const abertas = parcelasEmAberto(p.aluguel, hojeIso);
    if (abertas.length > 0) {
      const dias = diasEntre(hojeIso, abertas[0].vencimento);
      if (dias !== null) {
        alertas.push({
          chave: `aluguel-pagar:${p.id}`,
          pastoId: p.id,
          pastoNome: p.nome,
          titulo: "Aluguel a pagar",
          fim: abertas[0].vencimento,
          dias,
          tipo: "pagar",
          emAberto: abertas.length,
        });
      }
    }
    const fim = fimDoAluguel(p.aluguel);
    if (!fim) continue;
    const dias = diasEntre(hojeIso, fim);
    if (dias === null || dias > janela) continue;
    alertas.push({
      chave: `aluguel:${p.id}`,
      pastoId: p.id,
      pastoNome: p.nome,
      titulo: dias < 0 ? "Aluguel venceu" : "Aluguel termina",
      fim,
      dias,
      tipo: "fim",
    });
  }
  return alertas.sort((a, b) => a.dias - b.dias);
}
