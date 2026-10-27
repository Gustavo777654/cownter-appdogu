export type SyncStatus = "pending" | "synced";

/**
 * Campos de controle de todo registro que será sincronizado com o servidor.
 * Toda alteração feita offline fica "pending"; a exclusão é lógica (deletedAt)
 * para o servidor saber que o registro foi removido quando o aparelho voltar
 * a ter internet.
 */
interface Sincronizavel {
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deletedAt: string | null; // ISO quando excluído
  syncStatus: SyncStatus;
}

// ---------------------------------------------------------------------------
// Lotes de gado (o conjunto de animais) e cabeças (cada animal, opcional)
// ---------------------------------------------------------------------------

export type Sexo = "Fêmea" | "Macho";
export const SEXOS: readonly Sexo[] = ["Fêmea", "Macho"];

/** Categorias de cada sexo, na ordem em que o animal cresce. */
export const CATEGORIAS: Record<Sexo, readonly string[]> = {
  Fêmea: [
    "Bezerra",
    "Vitela",
    "Novilha",
    "Vaca atrasada",
    "Vaca mojando",
    "Vaca parida",
  ],
  Macho: ["Bezerro", "Garrote", "Boi", "Touro"],
};

/**
 * Uma linha da composição do lote: quantas cabeças de cada sexo e categoria.
 * Um lote misto tem várias linhas (ex.: 12 vacas atrasadas + 1 touro).
 */
export interface LinhaComposicao {
  sexo: Sexo;
  categoria: string;
  quantidade: number;
}

/** Vacina do lote: se foi aplicada e, quando foi só em parte, quantas cabeças faltam. */
export interface VacinaLote {
  nome: string;
  aplicada: boolean;
  /** Cabeças que ficaram sem a vacina (só vale quando aplicada = true). */
  faltam: number | null;
  data: string; // YYYY-MM-DD ("" quando não lembra ou não foi aplicada)
}

/** Sugestões para o campo de origem, que é texto livre (o produtor escreve o que quiser). */
export const SUGESTOES_ORIGEM = ["Nascido na fazenda", "Comprado", "Doação", "Troca"] as const;

export const SITUACOES_LOTE_GADO = ["Normal", "Separado para venda"] as const;
export type SituacaoLoteGado = (typeof SITUACOES_LOTE_GADO)[number];

export interface LoteGado extends Sincronizavel {
  id: string; // UUID gerado no aparelho
  nome: string;
  pastoId: string | null; // cada lote fica em um único pasto ("sem pasto" = null)
  composicao: LinhaComposicao[];
  raca: string;
  pesoMedioKg: number | null;
  origem: string; // texto livre: de onde o lote veio ("" = não informado)
  situacao: SituacaoLoteGado;
  vacinas: VacinaLote[];
  observacoes: string;
}

export type LoteGadoInput = Omit<
  LoteGado,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "syncStatus"
>;

/**
 * Registro de um parto dentro de um lote. O bezerro fica no lote da mãe
 * ("mamando") até o produtor desmamar; aí ele sai para outro lote.
 */
export interface Parto extends Sincronizavel {
  id: string;
  loteGadoId: string; // lote onde a vaca estava ao parir
  data: string; // YYYY-MM-DD: data do nascimento
  sexoBezerro: Sexo;
  vaca: string; // brinco, nome ou cor da vaca ("" = não informado)
  desmamado: boolean;
  desmamadoEm: string | null; // YYYY-MM-DD
  destinoLoteId: string | null; // lote para onde o bezerro foi ao desmamar
}

/** Uma cabeça cadastrada individualmente dentro de um lote (opcional). */
export interface Cabeca extends Sincronizavel {
  id: string;
  loteGadoId: string;
  brinco: string;
  cor: string;
  nome: string;
  raca: string;
  sexo: Sexo;
  dataNascimento: string; // YYYY-MM-DD ("" quando não informada)
  pesoKg: number | null;
  mae: string;
  pai: string;
  observacoes: string;
}

export type CabecaInput = Omit<
  Cabeca,
  "id" | "loteGadoId" | "createdAt" | "updatedAt" | "deletedAt" | "syncStatus"
>;

// ---------------------------------------------------------------------------
// Pastos (o terreno)
// ---------------------------------------------------------------------------

/** Quantidade de capim disponível no pasto. */
export const NIVEIS_PASTO = ["Alto", "Médio", "Baixo"] as const;
export type NivelPasto = (typeof NIVEIS_PASTO)[number];

/** "Reservado" = pasto em descanso, sem lotes de gado (rodízio de pastagem). */
export type SituacaoPasto = "Em uso" | "Reservado";

export interface Pasto extends Sincronizavel {
  id: string;
  nome: string;
  areaHa: number | null;
  nivelPasto: NivelPasto;
  nivelEm: string; // YYYY-MM-DD: quando o nível foi atualizado
  situacao: SituacaoPasto;
  situacaoDesde: string; // YYYY-MM-DD: desde quando está nessa situação

  // Rotina do remédio: repete a cada N meses a partir da última aplicação.
  remedioUltimaData: string; // YYYY-MM-DD ("" = nunca registrado)
  remedioIntervaloMeses: number | null;

  // Rotina do sal: repete a cada N dias a partir da última vez que levou sal.
  salUltimaData: string; // YYYY-MM-DD ("" = nunca registrado)
  salIntervaloDias: number | null;
}

export type PastoInput = Pick<Pasto, "nome" | "areaHa" | "nivelPasto">;

/** Tarefa de um pasto (arrumar cerca, jogar adubo, roçar, jogar veneno...). */
export interface Tarefa extends Sincronizavel {
  id: string;
  pastoId: string;
  titulo: string;
  observacao: string;
  prazo: string; // YYYY-MM-DD ("" = sem prazo)
  feita: boolean;
  feitaEm: string | null; // ISO
}

/** Observação livre sobre um pasto. */
export interface Nota extends Sincronizavel {
  id: string;
  pastoId: string;
  texto: string;
  data: string; // YYYY-MM-DD
}

export interface User {
  email: string;
  name: string;
  farm: string;
}
