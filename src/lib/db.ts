import Dexie, { type EntityTable } from "dexie";
import type { Animal, Lote, Nota, Tarefa } from "./types";

/**
 * Banco local do Cownter (IndexedDB via Dexie).
 *
 * Todas as telas leem e gravam aqui, nunca direto na internet. É isso que faz o
 * app funcionar no curral sem sinal. Quando o backend existir, uma fila de
 * sincronização envia os registros com syncStatus = "pending".
 */
class CownterDB extends Dexie {
  animals!: EntityTable<Animal, "id">;
  lotes!: EntityTable<Lote, "id">;
  tarefas!: EntityTable<Tarefa, "id">;
  notas!: EntityTable<Nota, "id">;

  constructor() {
    super("cownter");

    // Versão 1: só animais.
    this.version(1).stores({
      // Só os campos usados em buscas/filtros precisam ser indexados.
      animals: "id, brinco, nome, status, syncStatus, updatedAt, deletedAt",
    });

    // Versão 2: lotes (pastos), tarefas, observações; animal ganha pasto e vacinas.
    this.version(2)
      .stores({
        animals:
          "id, brinco, nome, status, loteId, syncStatus, updatedAt, deletedAt",
        lotes: "id, nome, situacao, syncStatus, updatedAt, deletedAt",
        tarefas: "id, loteId, prazo, syncStatus, updatedAt, deletedAt",
        notas: "id, loteId, syncStatus, updatedAt, deletedAt",
      })
      .upgrade((tx) =>
        // Animais cadastrados na versão 1 continuam valendo: entram sem pasto e sem vacinas.
        tx
          .table("animals")
          .toCollection()
          .modify((a) => {
            if (a.loteId === undefined) a.loteId = null;
            if (!Array.isArray(a.vacinas)) a.vacinas = [];
          })
      );
  }
}

export const db = new CownterDB();
