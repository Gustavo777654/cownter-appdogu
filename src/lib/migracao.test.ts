// Garante que quem já usou a versão 1 do app (só animais) não perde nada ao atualizar.
// Este arquivo cria um banco no formato antigo ANTES de carregar o banco novo.
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Dexie from "dexie";

describe("migração do banco da versão 1 para a 2", () => {
  it("mantém os animais antigos, sem pasto e sem vacinas, e abre as tabelas novas", async () => {
    // Banco no formato antigo, com um animal cadastrado.
    const antigo = new Dexie("cownter");
    antigo.version(1).stores({
      animals: "id, brinco, nome, status, syncStatus, updatedAt, deletedAt",
    });
    await antigo.table("animals").add({
      id: "11111111-1111-4111-8111-111111111111",
      brinco: "BR-001",
      nome: "Margarida",
      raca: "Nelore",
      sexo: "Fêmea",
      dataNascimento: "2021-05-15",
      pesoKg: 480,
      mae: "",
      pai: "",
      status: "Saudável",
      observacoes: "",
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-01T10:00:00.000Z",
      deletedAt: null,
      syncStatus: "pending",
    });
    antigo.close();

    // Abre pelo código do app (versão 2) e confere.
    const { db } = await import("./db");
    const animal = await db.animals.get("11111111-1111-4111-8111-111111111111");
    assert.equal(animal?.brinco, "BR-001");
    assert.equal(animal?.nome, "Margarida");
    assert.equal(animal?.pesoKg, 480);
    assert.equal(animal?.loteId, null);
    assert.deepEqual(animal?.vacinas, []);

    assert.equal(await db.lotes.count(), 0);
    assert.equal(await db.tarefas.count(), 0);
    assert.equal(await db.notas.count(), 0);

    // Os animais antigos continuam funcionando com as regras novas.
    const { atualizarAnimal } = await import("./animals");
    await atualizarAnimal("11111111-1111-4111-8111-111111111111", {
      brinco: "BR-001",
      nome: "Margarida",
      raca: "Nelore",
      sexo: "Fêmea",
      dataNascimento: "2021-05-15",
      pesoKg: 490,
      mae: "",
      pai: "",
      status: "Saudável",
      observacoes: "",
      loteId: null,
      vacinas: [{ nome: "Aftosa", data: "2026-05-10" }],
    });
    const editado = await db.animals.get("11111111-1111-4111-8111-111111111111");
    assert.equal(editado?.pesoKg, 490);
    assert.equal(editado?.vacinas.length, 1);
  });
});
