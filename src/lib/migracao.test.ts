// Garante que quem já usou versões anteriores do app não perde os pastos, tarefas e observações
// ao atualizar. Este arquivo cria um banco no formato antigo ANTES de carregar o banco novo.
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Dexie from "dexie";

const SYNC = { createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:00:00.000Z", deletedAt: null, syncStatus: "pending" };

describe("migração do banco da versão 2 para a 5", () => {
  it("mantém pastos, tarefas e observações e descarta os animais soltos", async () => {
    // Banco no formato da versão 2: lotes (eram os pastos), animais, tarefas e observações.
    const antigo = new Dexie("cownter");
    antigo.version(1).stores({ animals: "id, brinco, nome, status, syncStatus, updatedAt, deletedAt" });
    antigo.version(2).stores({
      animals: "id, brinco, nome, status, loteId, syncStatus, updatedAt, deletedAt",
      lotes: "id, nome, situacao, syncStatus, updatedAt, deletedAt",
      tarefas: "id, loteId, prazo, syncStatus, updatedAt, deletedAt",
      notas: "id, loteId, syncStatus, updatedAt, deletedAt",
    });
    await antigo.table("lotes").add({
      id: "pasto-1",
      nome: "Pasto Norte",
      areaHa: 15.5,
      nivelPasto: "Alto",
      nivelEm: "2026-10-01",
      situacao: "Em uso",
      situacaoDesde: "2026-10-01",
      remedioUltimaData: "2026-04-23",
      remedioIntervaloMeses: 6,
      salUltimaData: "2026-10-01",
      salIntervaloDias: 30,
      ...SYNC,
    });
    await antigo.table("tarefas").add({
      id: "tarefa-1",
      loteId: "pasto-1",
      titulo: "Arrumar a cerca",
      observacao: "",
      prazo: "2026-11-01",
      feita: false,
      feitaEm: null,
      ...SYNC,
    });
    await antigo.table("notas").add({ id: "nota-1", loteId: "pasto-1", texto: "Capim bom", data: "2026-10-01", ...SYNC });
    await antigo.table("animals").add({
      id: "animal-1",
      brinco: "BR-001",
      nome: "Margarida",
      raca: "Nelore",
      sexo: "Fêmea",
      dataNascimento: "",
      pesoKg: 480,
      mae: "",
      pai: "",
      status: "Saudável",
      observacoes: "",
      loteId: "pasto-1",
      vacinas: [],
      ...SYNC,
    });
    antigo.close();

    // Abre pelo código do app (versão 5) e confere.
    const { db } = await import("./db");

    const pasto = await db.pastos.get("pasto-1");
    assert.equal(pasto?.nome, "Pasto Norte");
    assert.equal(pasto?.remedioIntervaloMeses, 6);
    assert.equal(pasto?.salIntervaloDias, 30);

    const tarefa = await db.tarefas.get("tarefa-1");
    assert.equal(tarefa?.pastoId, "pasto-1");
    assert.equal((tarefa as unknown as { loteId?: string }).loteId, undefined);
    const nota = await db.notas.get("nota-1");
    assert.equal(nota?.pastoId, "pasto-1");

    // As tabelas antigas saíram e as novas começam vazias.
    assert.deepEqual(db.tables.map((t) => t.name).sort(), ["cabecas", "lotesGado", "notas", "partos", "pastos", "tarefas"]);
    assert.equal(await db.lotesGado.count(), 0);
    assert.equal(await db.cabecas.count(), 0);

    // Os dados migrados funcionam com as regras novas.
    const { criarLoteGado } = await import("./gado");
    const lote = await criarLoteGado({
      nome: "Matrizes",
      pastoId: "pasto-1",
      composicao: [{ sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 8 }],
      raca: "",
      pesoMedioKg: null,
      origem: "",
      situacao: "Normal",
      vacinas: [],
      observacoes: "",
    });
    assert.equal(lote.pastoId, "pasto-1");
    const { criarTarefa } = await import("./pastos");
    await criarTarefa("pasto-1", { titulo: "Roçar", observacao: "", prazo: "" });
    assert.equal(await db.tarefas.count(), 2);
  });
});
