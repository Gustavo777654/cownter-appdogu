// Testes da camada de dados local (IndexedDB simulado em memória).
// Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { atualizarAnimal, criarAnimal, excluirAnimal } from "./animals";
import { db } from "./db";
import { carregarDadosExemplo } from "./exemplo";
import { criarLote } from "./lotes";
import type { AnimalInput } from "./types";
import { formatIdade, uuid } from "./utils";

const base: AnimalInput = {
  brinco: "br-100",
  nome: "  Mimosa ",
  raca: "Nelore",
  sexo: "Fêmea",
  dataNascimento: "2023-01-10",
  pesoKg: 300,
  mae: "",
  pai: "",
  status: "Saudável",
  observacoes: "",
  loteId: null,
  vacinas: [],
};

async function ativos() {
  return db.animals.filter((a) => !a.deletedAt).toArray();
}

describe("cadastro de animais", () => {
  beforeEach(async () => {
    await db.animals.clear();
  });

  it("cria o animal com UUID, brinco normalizado e marcado para sincronizar", async () => {
    const a = await criarAnimal(base);
    assert.match(a.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(a.brinco, "BR-100");
    assert.equal(a.nome, "Mimosa");
    assert.equal(a.syncStatus, "pending");
    assert.equal(a.deletedAt, null);
    assert.equal((await ativos()).length, 1);
  });

  it("exige o brinco", async () => {
    await assert.rejects(() => criarAnimal({ ...base, brinco: "   " }), /brinco/i);
  });

  it("rejeita brinco duplicado, mesmo com letras diferentes", async () => {
    await criarAnimal(base);
    await assert.rejects(() => criarAnimal({ ...base, brinco: "BR-100" }), /Já existe/);
  });

  it("guarda as vacinas já aplicadas, ignorando linhas sem nome", async () => {
    const a = await criarAnimal({
      ...base,
      vacinas: [
        { nome: " Aftosa ", data: "2026-05-10" },
        { nome: "   ", data: "2026-01-01" },
        { nome: "Brucelose", data: "" },
      ],
    });
    assert.deepEqual(a.vacinas, [
      { nome: "Aftosa", data: "2026-05-10" },
      { nome: "Brucelose", data: "" },
    ]);
  });

  it("rejeita vacina com data no futuro", async () => {
    await assert.rejects(
      () => criarAnimal({ ...base, vacinas: [{ nome: "Aftosa", data: "2999-01-01" }] }),
      /futuro/
    );
  });

  it("aceita animal em um pasto e rejeita pasto que não existe", async () => {
    const lote = await criarLote({ nome: "Pasto A", areaHa: null, nivelPasto: "Alto" });
    const a = await criarAnimal({ ...base, loteId: lote.id });
    assert.equal(a.loteId, lote.id);
    await assert.rejects(
      () => criarAnimal({ ...base, brinco: "BR-300", loteId: "nao-existe" }),
      /não existe/
    );
  });

  it("permite reaproveitar o brinco de um animal excluído", async () => {
    const a = await criarAnimal(base);
    await excluirAnimal(a.id);
    const b = await criarAnimal({ ...base, nome: "Nova" });
    assert.equal(b.brinco, "BR-100");
  });
});

describe("edição e exclusão", () => {
  beforeEach(async () => {
    await db.animals.clear();
  });

  it("editar atualiza os dados e volta a marcar como pendente de sincronização", async () => {
    const a = await criarAnimal(base);
    await db.animals.update(a.id, { syncStatus: "synced" });

    await atualizarAnimal(a.id, { ...base, pesoKg: 350, status: "Em tratamento" });

    const depois = await db.animals.get(a.id);
    assert.equal(depois?.pesoKg, 350);
    assert.equal(depois?.status, "Em tratamento");
    assert.equal(depois?.syncStatus, "pending");
    assert.ok(depois!.updatedAt >= a.updatedAt);
  });

  it("não deixa editar para o brinco de outro animal", async () => {
    await criarAnimal(base);
    const outro = await criarAnimal({ ...base, brinco: "BR-200" });
    await assert.rejects(
      () => atualizarAnimal(outro.id, { ...base, brinco: "BR-100" }),
      /Já existe/
    );
  });

  it("permite salvar o próprio animal sem mudar o brinco", async () => {
    const a = await criarAnimal(base);
    await atualizarAnimal(a.id, { ...base, observacoes: "ok" });
    assert.equal((await db.animals.get(a.id))?.observacoes, "ok");
  });

  it("exclusão é lógica: some da lista, mas o registro fica para sincronizar", async () => {
    const a = await criarAnimal(base);
    await db.animals.update(a.id, { syncStatus: "synced" });

    await excluirAnimal(a.id);

    assert.equal((await ativos()).length, 0);
    const registro = await db.animals.get(a.id);
    assert.ok(registro?.deletedAt);
    assert.equal(registro?.syncStatus, "pending");
  });
});

describe("dados de exemplo", () => {
  beforeEach(async () => {
    await Promise.all([db.animals.clear(), db.lotes.clear(), db.tarefas.clear(), db.notas.clear()]);
  });

  it("carrega pastos e rebanho de exemplo uma única vez", async () => {
    assert.equal(await carregarDadosExemplo(), 5);
    assert.equal(await carregarDadosExemplo(), 0);
    assert.equal((await ativos()).length, 5);
    assert.equal((await db.lotes.filter((l) => !l.deletedAt).toArray()).length, 3);
    // 3 tarefas nos pastos de exemplo, sem duplicar na segunda carga
    assert.equal((await db.tarefas.toArray()).length, 3);
  });

  it("deixa o pasto reservado sem animais", async () => {
    await carregarDadosExemplo();
    const brejo = await db.lotes.filter((l) => l.nome === "Pasto do Brejo").first();
    assert.equal(brejo?.situacao, "Reservado");
    assert.equal(await db.animals.where("loteId").equals(brejo!.id).count(), 0);
  });
});

describe("utilitários", () => {
  const ref = new Date(2026, 9, 23); // 23/10/2026

  it("calcula a idade em meses e anos", () => {
    assert.equal(formatIdade("2026-09-30", ref), "menos de 1 mês");
    assert.equal(formatIdade("2025-12-01", ref), "10 meses");
    assert.equal(formatIdade("2024-10-23", ref), "2 anos");
    assert.equal(formatIdade("2024-02-10", ref), "2 anos e 8 meses");
    assert.equal(formatIdade("", ref), "—");
    assert.equal(formatIdade("2027-01-01", ref), "—");
  });

  it("gera UUIDs únicos", () => {
    assert.notEqual(uuid(), uuid());
  });
});
