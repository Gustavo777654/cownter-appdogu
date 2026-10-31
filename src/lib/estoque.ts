import { diasEntre } from "./rotinas";
import type { Recurso, UsoRecurso } from "./types";

// Funções puras (sem banco): quanto dura o estoque e quando avisar.

/** Só olha o uso dos últimos N dias para calcular o consumo médio. */
export const JANELA_CONSUMO_DIAS = 90;

export interface Consumo {
  /** Unidades (sacos/frascos) por dia, em média. */
  porDia: number;
  usos: number;
}

/** Consumo médio do item: total usado dividido pelos dias desde o primeiro uso da janela. Precisa de 2 usos. */
export function consumoMedio(recursoId: string, usos: Pick<UsoRecurso, "recursoId" | "data" | "quantidade" | "deletedAt">[], hojeIso: string): Consumo | null {
  const meus = usos.filter((u) => u.recursoId === recursoId && !u.deletedAt).filter((u) => {
    const d = diasEntre(u.data, hojeIso);
    return d !== null && d >= 0 && d <= JANELA_CONSUMO_DIAS;
  });
  if (meus.length < 2) return null;
  const primeiro = meus.map((u) => u.data).sort()[0];
  const dias = Math.max(1, diasEntre(primeiro, hojeIso) ?? 1);
  const total = meus.reduce((s, u) => s + u.quantidade, 0);
  if (total <= 0) return null;
  return { porDia: total / dias, usos: meus.length };
}

/** Dias que o estoque dura no ritmo atual (null = sem consumo suficiente para estimar). */
export function diasDeEstoque(estoque: number, consumo: Consumo | null): number | null {
  if (!consumo) return null;
  return Math.floor(estoque / consumo.porDia);
}

export interface AlertaEstoque {
  chave: string;
  recursoId: string;
  nome: string;
  titulo: string;
  detalhe: string;
  /** vermelho = acabou ou abaixo do mínimo; amarelo = previsão de acabar. */
  grave: boolean;
}

export function coletarAlertasEstoque(
  recursos: Recurso[],
  usos: UsoRecurso[],
  hojeIso: string,
  diasAviso: number
): AlertaEstoque[] {
  const alertas: AlertaEstoque[] = [];
  const un = (r: Recurso) => (r.tipo === "Suplemento" ? "sacos" : "frascos");

  for (const r of recursos) {
    if (r.deletedAt) continue;
    if (r.estoque <= 0) {
      alertas.push({ chave: `estoque:${r.id}`, recursoId: r.id, nome: r.nome, titulo: `Acabou ${r.nome}`, detalhe: "Estoque zerado", grave: true });
      continue;
    }
    if (r.estoqueMinimo !== null && r.estoque <= r.estoqueMinimo) {
      alertas.push({
        chave: `estoque:${r.id}`,
        recursoId: r.id,
        nome: r.nome,
        titulo: `Estoque baixo: ${r.nome}`,
        detalhe: `Restam ${r.estoque.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${un(r)} (mínimo ${r.estoqueMinimo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })})`,
        grave: true,
      });
      continue;
    }
    const dias = diasDeEstoque(r.estoque, consumoMedio(r.id, usos, hojeIso));
    if (dias !== null && dias <= diasAviso) {
      alertas.push({
        chave: `estoque:${r.id}`,
        recursoId: r.id,
        nome: r.nome,
        titulo: `${r.nome} acaba logo`,
        detalhe: dias <= 0 ? "No ritmo atual acaba hoje" : `No ritmo atual dura cerca de ${dias} ${dias === 1 ? "dia" : "dias"}`,
        grave: false,
      });
    }
  }
  return alertas.sort((a, b) => Number(b.grave) - Number(a.grave) || a.nome.localeCompare(b.nome, "pt-BR"));
}
