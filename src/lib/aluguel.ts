import { addDias, addMeses, diasEntre } from "./rotinas";
import type { AluguelPasto, Pasto } from "./types";

// Aluguel de pasto: valor por mês, data de início e quantidade de meses (vazio = 1 mês).

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

/** Datas das parcelas mensais já começadas até hoje (a primeira é a data de início). */
export function parcelasAteHoje(a: AluguelPasto, hojeIso: string): string[] {
  const datas: string[] = [];
  for (let k = 0; k < mesesDoAluguel(a); k++) {
    const d = addMeses(a.inicio, k);
    if (!d || d > hojeIso) break;
    datas.push(d);
  }
  return datas;
}

export interface ParcelaAluguel {
  pastoId: string;
  pastoNome: string;
  data: string;
  valor: number;
}

export function parcelasDeAluguel(
  pastos: Pick<Pasto, "id" | "nome" | "aluguel" | "deletedAt">[],
  hojeIso: string
): ParcelaAluguel[] {
  const lista: ParcelaAluguel[] = [];
  for (const p of pastos) {
    if (p.deletedAt || !p.aluguel) continue;
    for (const data of parcelasAteHoje(p.aluguel, hojeIso)) {
      lista.push({ pastoId: p.id, pastoNome: p.nome, data, valor: valorDaParcela(p.aluguel, data) });
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
  /** Dias até o fim (negativo = já venceu). */
  dias: number;
}

/** Aluguéis que terminam em até 7 dias ou já terminaram. */
export function coletarAlertasAluguel(
  pastos: Pick<Pasto, "id" | "nome" | "aluguel" | "deletedAt">[],
  hojeIso: string,
  janela: number = JANELA_ALUGUEL_DIAS
): AlertaAluguel[] {
  const alertas: AlertaAluguel[] = [];
  for (const p of pastos) {
    if (p.deletedAt || !p.aluguel) continue;
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
    });
  }
  return alertas.sort((a, b) => a.dias - b.dias);
}
