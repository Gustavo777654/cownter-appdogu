import { addMeses, diasEntre } from "./rotinas";
import type { LoteGado, Parto } from "./types";

// Funções puras (sem banco) sobre a desmama dos bezerros.

/** Data em que o bezerro deve ser desmamado, a partir do nascimento. */
export function dataDesmama(nascimento: string, meses: number): string | null {
  return addMeses(nascimento, meses);
}

export interface AlertaDesmama {
  chave: string;
  loteId: string;
  loteNome: string;
  /** Quantos bezerros do lote já estão na idade (ou passam dela) dentro da janela. */
  quantidade: number;
  /** Dias até a desmama do mais velho (negativo = já passou). */
  dias: number;
}

/** Avisos de desmama agrupados por lote. Ignora partos desmamados, excluídos e de lotes excluídos. */
export function coletarAlertasDesmama(
  partos: Parto[],
  lotes: Pick<LoteGado, "id" | "nome">[],
  hojeIso: string,
  desmamaMeses: number,
  janela: number
): AlertaDesmama[] {
  const nomes = new Map(lotes.map((l) => [l.id, l.nome]));
  const grupos = new Map<string, AlertaDesmama>();

  for (const p of partos) {
    if (p.desmamado || p.deletedAt || !nomes.has(p.loteGadoId)) continue;
    const data = dataDesmama(p.data, desmamaMeses);
    if (!data) continue;
    const dias = diasEntre(hojeIso, data);
    if (dias === null || dias > janela) continue;

    const atual = grupos.get(p.loteGadoId);
    if (atual) {
      atual.quantidade += 1;
      atual.dias = Math.min(atual.dias, dias);
    } else {
      grupos.set(p.loteGadoId, {
        chave: `desmama:${p.loteGadoId}`,
        loteId: p.loteGadoId,
        loteNome: nomes.get(p.loteGadoId)!,
        quantidade: 1,
        dias,
      });
    }
  }

  return Array.from(grupos.values()).sort((a, b) => a.dias - b.dias || a.loteNome.localeCompare(b.loteNome, "pt-BR"));
}
