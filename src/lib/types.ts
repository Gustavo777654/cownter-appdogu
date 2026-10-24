export type SyncStatus = "pending" | "synced";

export const STATUS_LIST = [
  "Saudável",
  "Vacinação pendente",
  "Em tratamento",
] as const;
export type AnimalStatus = (typeof STATUS_LIST)[number];

export type Sexo = "Fêmea" | "Macho";

/** Vacina que o animal já recebeu (registrada no cadastro). */
export interface VacinaFeita {
  nome: string;
  data: string; // YYYY-MM-DD ("" quando o produtor não lembra)
}

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

/** Animal do rebanho bovino. */
export interface Animal extends Sincronizavel {
  id: string; // UUID gerado no aparelho
  brinco: string;
  nome: string;
  raca: string;
  sexo: Sexo;
  dataNascimento: string; // YYYY-MM-DD ("" quando não informada)
  pesoKg: number | null;
  mae: string;
  pai: string;
  status: AnimalStatus;
  observacoes: string;
  loteId: string | null; // pasto onde o animal está (um único lote por vez)
  vacinas: VacinaFeita[];
}

export type AnimalInput = Omit<
  Animal,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "syncStatus"
>;

// ---------------------------------------------------------------------------
// Lotes (pastos)
// ---------------------------------------------------------------------------

/** Quantidade de capim disponível no pasto. */
export const NIVEIS_PASTO = ["Alto", "Médio", "Baixo"] as const;
export type NivelPasto = (typeof NIVEIS_PASTO)[number];

/** "Reservado" = pasto em descanso, sem animais (rodízio de pastagem). */
export type SituacaoLote = "Em uso" | "Reservado";

export interface Lote extends Sincronizavel {
  id: string;
  nome: string;
  areaHa: number | null;
  nivelPasto: NivelPasto;
  nivelEm: string; // YYYY-MM-DD: quando o nível foi atualizado
  situacao: SituacaoLote;
  situacaoDesde: string; // YYYY-MM-DD: desde quando está nessa situação

  // Rotina do remédio: repete a cada N meses a partir da última aplicação.
  remedioUltimaData: string; // YYYY-MM-DD ("" = nunca registrado)
  remedioIntervaloMeses: number | null;

  // Rotina do sal: repete a cada N dias a partir da última vez que levou sal.
  salUltimaData: string; // YYYY-MM-DD ("" = nunca registrado)
  salIntervaloDias: number | null;
}

export type LoteInput = Pick<Lote, "nome" | "areaHa" | "nivelPasto">;

/** Tarefa de um lote (arrumar cerca, jogar adubo, roçar, jogar veneno...). */
export interface Tarefa extends Sincronizavel {
  id: string;
  loteId: string;
  titulo: string;
  observacao: string;
  prazo: string; // YYYY-MM-DD ("" = sem prazo)
  feita: boolean;
  feitaEm: string | null; // ISO
}

/** Observação livre sobre um lote. */
export interface Nota extends Sincronizavel {
  id: string;
  loteId: string;
  texto: string;
  data: string; // YYYY-MM-DD
}

export interface User {
  email: string;
  name: string;
  farm: string;
}
