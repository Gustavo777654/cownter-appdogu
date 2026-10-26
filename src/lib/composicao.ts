import { CATEGORIAS, type LinhaComposicao, type LoteGado } from "./types";

// Funções puras (sem banco) sobre a composição de um lote de gado.

/** Total de cabeças do lote: a soma de todas as linhas. */
export function totalCabecas(composicao: LinhaComposicao[]): number {
  return composicao.reduce((soma, l) => soma + l.quantidade, 0);
}

/** Total de cabeças de vários lotes. */
export function totalDeLotes(lotes: Pick<LoteGado, "composicao">[]): number {
  return lotes.reduce((soma, l) => soma + totalCabecas(l.composicao), 0);
}

/**
 * Confere as linhas e devolve uma cópia limpa: junta linhas repetidas
 * (mesmo sexo e categoria) e descarta as zeradas. Lança erro se algo estiver errado.
 */
export function limparComposicao(linhas: LinhaComposicao[]): LinhaComposicao[] {
  const mapa = new Map<string, LinhaComposicao>();

  for (const l of linhas) {
    if (!(l.sexo in CATEGORIAS)) throw new Error("Escolha o sexo de cada linha.");
    if (!CATEGORIAS[l.sexo].includes(l.categoria)) {
      throw new Error(`A categoria ${l.categoria || "(vazia)"} não existe para ${l.sexo.toLowerCase()}.`);
    }
    if (!Number.isInteger(l.quantidade) || l.quantidade < 0 || l.quantidade > 100000) {
      throw new Error("A quantidade de cabeças deve ser um número inteiro.");
    }
    if (l.quantidade === 0) continue;

    const chave = `${l.sexo}|${l.categoria}`;
    const existente = mapa.get(chave);
    if (existente) existente.quantidade += l.quantidade;
    else mapa.set(chave, { ...l });
  }

  const limpas = Array.from(mapa.values());
  if (limpas.length === 0) throw new Error("Informe pelo menos uma categoria com a quantidade de cabeças.");
  return limpas;
}

/** "12 vaca atrasada · 4 vaca mojando" para a lista de lotes. */
export function resumoComposicao(composicao: LinhaComposicao[]): string {
  return composicao.map((l) => `${l.quantidade} ${l.categoria.toLowerCase()}`).join(" · ");
}

export function descreverCabecas(total: number): string {
  return `${total} ${total === 1 ? "cabeça" : "cabeças"}`;
}
