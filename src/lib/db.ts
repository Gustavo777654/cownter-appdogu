import Dexie, { type EntityTable } from "dexie";
import type { Cabeca, CompraRecurso, LoteGado, Nota, Parto, Pasto, Recurso, Tarefa, UsoRecurso } from "./types";

/**
 * Banco local do Cownter (IndexedDB via Dexie).
 *
 * Todas as telas leem e gravam aqui, nunca direto na internet. É isso que faz o
 * app funcionar no curral sem sinal. Quando o backend existir, uma fila de
 * sincronização envia os registros com syncStatus = "pending".
 */
class CownterDB extends Dexie {
  pastos!: EntityTable<Pasto, "id">;
  lotesGado!: EntityTable<LoteGado, "id">;
  cabecas!: EntityTable<Cabeca, "id">;
  tarefas!: EntityTable<Tarefa, "id">;
  notas!: EntityTable<Nota, "id">;
  partos!: EntityTable<Parto, "id">;
  recursos!: EntityTable<Recurso, "id">;
  comprasRecurso!: EntityTable<CompraRecurso, "id">;
  usosRecurso!: EntityTable<UsoRecurso, "id">;

  constructor() {
    super("cownter");

    // Versão 1: só animais.
    this.version(1).stores({
      animals: "id, brinco, nome, status, syncStatus, updatedAt, deletedAt",
    });

    // Versão 2: lotes (que eram os pastos), tarefas, observações; animal ganha pasto e vacinas.
    this.version(2)
      .stores({
        animals: "id, brinco, nome, status, loteId, syncStatus, updatedAt, deletedAt",
        lotes: "id, nome, situacao, syncStatus, updatedAt, deletedAt",
        tarefas: "id, loteId, prazo, syncStatus, updatedAt, deletedAt",
        notas: "id, loteId, syncStatus, updatedAt, deletedAt",
      })
      .upgrade((tx) =>
        tx
          .table("animals")
          .toCollection()
          .modify((a) => {
            if (a.loteId === undefined) a.loteId = null;
            if (!Array.isArray(a.vacinas)) a.vacinas = [];
          })
      );

    // Versão 3: "lote" passa a ser o conjunto de gado; o terreno agora é "pasto".
    // As tabelas antigas continuam existindo nesta versão para o upgrade poder ler;
    // elas só são apagadas na versão 4 (é assim que o Dexie renomeia tabelas).
    this.version(3)
      .stores({
        pastos: "id, nome, situacao, syncStatus, updatedAt, deletedAt",
        lotesGado: "id, nome, pastoId, situacao, syncStatus, updatedAt, deletedAt",
        cabecas: "id, loteGadoId, brinco, syncStatus, updatedAt, deletedAt",
        tarefas: "id, pastoId, prazo, syncStatus, updatedAt, deletedAt",
        notas: "id, pastoId, syncStatus, updatedAt, deletedAt",
      })
      .upgrade(async (tx) => {
        // Os pastos da versão 2 (tabela "lotes") continuam valendo, com os mesmos ids.
        const pastosAntigos = await tx.table("lotes").toArray();
        if (pastosAntigos.length > 0) await tx.table("pastos").bulkAdd(pastosAntigos);

        // Tarefas e observações passam a apontar para o pasto.
        for (const nome of ["tarefas", "notas"] as const) {
          await tx
            .table(nome)
            .toCollection()
            .modify((r) => {
              if (r.pastoId === undefined) r.pastoId = r.loteId;
              delete r.loteId;
            });
        }
        // Os animais soltos da versão 2 não têm equivalente: o rebanho agora é organizado
        // em lotes de gado, que o produtor cadastra de novo.
      });

    // Versão 4: remove as tabelas antigas, já copiadas na versão 3.
    this.version(4).stores({ lotes: null, animals: null });

    // Versão 5: partos e desmama dentro dos lotes de gado.
    this.version(5).stores({
      partos: "id, loteGadoId, data, syncStatus, updatedAt, deletedAt",
    });

    // Versão 6: estoque de suplementos e remédios (Recursos).
    this.version(6).stores({
      recursos: "id, tipo, nome, syncStatus, updatedAt, deletedAt",
      comprasRecurso: "id, recursoId, data, syncStatus, updatedAt, deletedAt",
      usosRecurso: "id, recursoId, pastoId, data, syncStatus, updatedAt, deletedAt",
    });
  }
}

export const db = new CownterDB();
