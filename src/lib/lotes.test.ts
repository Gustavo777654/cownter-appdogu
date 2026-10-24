// Testes dos pastos: rodízio, reserva, rotinas, tarefas e observações
// (IndexedDB simulado em memória). Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { criarAnimal } from "./animals";
import { db } from "./db";
import {
  alterarSituacao,
  alternarTarefa,
  atualizarLote,
  atualizarNivel,
  configurarRotina,
  criarLote,
  criarNota,
  criarTarefa,
  excluirLote,
  excluirNota,
  excluirTarefa,
  marcarRotinaFeita,
  moverAnimais,
  moverTodos,
} from "./lotes";
import { addDias } from "./rotinas";
import type { AnimalInput } from "./types";
import { hoje } from "./utils";

const novoLote = (nome: string) => criarLote({ nome, areaHa: 10, nivelPasto: "Médio" });

let seq = 0;
const novoAnimal = (loteId: string | null = null) => {
  seq++;
  const dados: AnimalInput = {
    brinco: `T-${seq}`,
    nome: "",
    raca: "",
    sexo: "Fêmea",
    dataNascimento: "",
    pesoKg: null,
    mae: "",
    pai: "",
    status: "Saudável",
    observacoes: "",
    loteId,
    vacinas: [],
  };
  return criarAnimal(dados);
};

beforeEach(async () => {
  await Promise.all([db.animals.clear(), db.lotes.clear(), db.tarefas.clear(), db.notas.clear()]);
});

describe("pastos", () => {
  it("cria o pasto em uso, com nível, sem rotinas e marcado para sincronizar", async () => {
    const l = await novoLote("  Pasto   Norte ");
    assert.equal(l.nome, "Pasto Norte");
    assert.equal(l.situacao, "Em uso");
    assert.equal(l.nivelPasto, "Médio");
    assert.equal(l.situacaoDesde, hoje());
    assert.equal(l.remedioIntervaloMeses, null);
    assert.equal(l.salIntervaloDias, null);
    assert.equal(l.syncStatus, "pending");
    assert.match(l.id, /^[0-9a-f-]{36}$/);
  });

  it("exige nome, rejeita nome repetido (sem diferenciar maiúsculas) e área inválida", async () => {
    await novoLote("Pasto Sul");
    await assert.rejects(() => novoLote("   "), /nome/i);
    await assert.rejects(() => novoLote("pasto sul"), /Já existe/);
    await assert.rejects(
      () => criarLote({ nome: "X", areaHa: -3, nivelPasto: "Alto" }),
      /Área inválida/
    );
  });

  it("editar mantém o nome do próprio pasto e atualiza a data do nível só quando ele muda", async () => {
    const l = await novoLote("Pasto Leste");
    await db.lotes.update(l.id, { nivelEm: "2020-01-01" });

    await atualizarLote(l.id, { nome: "Pasto Leste", areaHa: 20, nivelPasto: "Médio" });
    assert.equal((await db.lotes.get(l.id))?.nivelEm, "2020-01-01");
    assert.equal((await db.lotes.get(l.id))?.areaHa, 20);

    await atualizarNivel(l.id, "Baixo");
    const depois = await db.lotes.get(l.id);
    assert.equal(depois?.nivelPasto, "Baixo");
    assert.equal(depois?.nivelEm, hoje());
  });
});

describe("rodízio: mover animais e reservar pasto", () => {
  it("move animais escolhidos e ignora os que já estão no destino", async () => {
    const a = await novoLote("A");
    const b = await novoLote("B");
    const x = await novoAnimal(a.id);
    const y = await novoAnimal(a.id);
    const z = await novoAnimal(b.id);

    assert.equal(await moverAnimais([x.id, z.id], b.id), 1); // z já estava em B
    assert.equal((await db.animals.get(x.id))?.loteId, b.id);
    assert.equal((await db.animals.get(y.id))?.loteId, a.id);
    assert.equal((await db.animals.get(x.id))?.syncStatus, "pending");
  });

  it("move todos os animais de um pasto para outro (o gesto do rodízio)", async () => {
    const a = await novoLote("A");
    const b = await novoLote("B");
    await novoAnimal(a.id);
    await novoAnimal(a.id);
    await novoAnimal(null);

    assert.equal(await moverTodos(a.id, b.id), 2);
    assert.equal(await db.animals.where("loteId").equals(a.id).count(), 0);
    assert.equal(await db.animals.where("loteId").equals(b.id).count(), 2);
    assert.equal(await moverTodos(a.id, a.id), 0);
  });

  it("move para 'sem pasto'", async () => {
    const a = await novoLote("A");
    const x = await novoAnimal(a.id);
    assert.equal(await moverAnimais([x.id], null), 1);
    assert.equal((await db.animals.get(x.id))?.loteId, null);
  });

  it("não deixa reservar um pasto que ainda tem animais", async () => {
    const a = await novoLote("A");
    await novoAnimal(a.id);
    await assert.rejects(() => alterarSituacao(a.id, "Reservado"), /1 animal/);
    assert.equal((await db.lotes.get(a.id))?.situacao, "Em uso");
  });

  it("reserva o pasto vazio, marca desde quando e bloqueia a entrada de animais", async () => {
    const a = await novoLote("A");
    const b = await novoLote("B");
    const x = await novoAnimal(a.id);

    await moverTodos(a.id, b.id);
    await db.lotes.update(a.id, { situacaoDesde: "2020-01-01" });
    await alterarSituacao(a.id, "Reservado");
    const reservado = await db.lotes.get(a.id);
    assert.equal(reservado?.situacao, "Reservado");
    assert.equal(reservado?.situacaoDesde, hoje());

    await assert.rejects(() => moverAnimais([x.id], a.id), /reservado/);
    await assert.rejects(() => novoAnimal(a.id), /reservado/);

    await alterarSituacao(a.id, "Em uso");
    assert.equal(await moverAnimais([x.id], a.id), 1);
  });

  it("excluir o pasto deixa os animais sem pasto e apaga tarefas e observações dele", async () => {
    const a = await novoLote("A");
    const x = await novoAnimal(a.id);
    await criarTarefa(a.id, { titulo: "Roçar", observacao: "", prazo: "" });
    await criarNota(a.id, "Capim bom");

    await excluirLote(a.id);

    assert.equal((await db.lotes.get(a.id))?.deletedAt !== null, true);
    assert.equal((await db.animals.get(x.id))?.loteId, null);
    assert.equal((await db.tarefas.filter((t) => !t.deletedAt).toArray()).length, 0);
    assert.equal((await db.notas.filter((n) => !n.deletedAt).toArray()).length, 0);
    // o nome pode ser reaproveitado depois da exclusão
    await novoLote("A");
  });
});

describe("rotinas de remédio e sal", () => {
  it("configura o remédio em meses e o sal em dias", async () => {
    const l = await novoLote("A");
    await configurarRotina(l.id, "remedio", { ultimaData: "2026-04-23", intervalo: 6 });
    await configurarRotina(l.id, "sal", { ultimaData: "2026-10-01", intervalo: 30 });
    const depois = await db.lotes.get(l.id);
    assert.equal(depois?.remedioUltimaData, "2026-04-23");
    assert.equal(depois?.remedioIntervaloMeses, 6);
    assert.equal(depois?.salUltimaData, "2026-10-01");
    assert.equal(depois?.salIntervaloDias, 30);
  });

  it("valida data no futuro, intervalo e a falta da última data", async () => {
    const l = await novoLote("A");
    await assert.rejects(
      () => configurarRotina(l.id, "sal", { ultimaData: addDias(hoje(), 3)!, intervalo: 30 }),
      /futuro/
    );
    await assert.rejects(
      () => configurarRotina(l.id, "sal", { ultimaData: "2026-10-01", intervalo: 0 }),
      /intervalo/
    );
    await assert.rejects(
      () => configurarRotina(l.id, "remedio", { ultimaData: "2026-10-01", intervalo: 2.5 }),
      /inteiro/
    );
    await assert.rejects(
      () => configurarRotina(l.id, "remedio", { ultimaData: "2026-10-01", intervalo: 99 }),
      /1 a 60 meses/
    );
    await assert.rejects(
      () => configurarRotina(l.id, "sal", { ultimaData: "", intervalo: 30 }),
      /última vez/
    );
  });

  it("permite limpar a rotina", async () => {
    const l = await novoLote("A");
    await configurarRotina(l.id, "sal", { ultimaData: "2026-10-01", intervalo: 30 });
    await configurarRotina(l.id, "sal", { ultimaData: "", intervalo: null });
    const depois = await db.lotes.get(l.id);
    assert.equal(depois?.salUltimaData, "");
    assert.equal(depois?.salIntervaloDias, null);
  });

  it("'feito hoje' leva a última data para hoje e mantém o intervalo", async () => {
    const l = await novoLote("A");
    await configurarRotina(l.id, "sal", { ultimaData: "2026-01-01", intervalo: 30 });
    await db.lotes.update(l.id, { syncStatus: "synced" });

    await marcarRotinaFeita(l.id, "sal");
    const depois = await db.lotes.get(l.id);
    assert.equal(depois?.salUltimaData, hoje());
    assert.equal(depois?.salIntervaloDias, 30);
    assert.equal(depois?.syncStatus, "pending");

    await marcarRotinaFeita(l.id, "remedio");
    assert.equal((await db.lotes.get(l.id))?.remedioUltimaData, hoje());
  });
});

describe("tarefas e observações", () => {
  it("cria, conclui, reabre e exclui tarefas", async () => {
    const l = await novoLote("A");
    const t = await criarTarefa(l.id, { titulo: "  Arrumar a cerca ", observacao: "", prazo: "2026-11-01" });
    assert.equal(t.titulo, "Arrumar a cerca");
    assert.equal(t.feita, false);

    await alternarTarefa(t.id);
    const feita = await db.tarefas.get(t.id);
    assert.equal(feita?.feita, true);
    assert.ok(feita?.feitaEm);

    await alternarTarefa(t.id);
    assert.equal((await db.tarefas.get(t.id))?.feita, false);
    assert.equal((await db.tarefas.get(t.id))?.feitaEm, null);

    await excluirTarefa(t.id);
    assert.ok((await db.tarefas.get(t.id))?.deletedAt);
  });

  it("exige descrição da tarefa e rejeita prazo inválido", async () => {
    const l = await novoLote("A");
    await assert.rejects(() => criarTarefa(l.id, { titulo: " ", observacao: "", prazo: "" }), /Descreva/);
    await assert.rejects(
      () => criarTarefa(l.id, { titulo: "Roçar", observacao: "", prazo: "amanhã" }),
      /Prazo inválido/
    );
  });

  it("não cria tarefa nem observação em pasto que não existe", async () => {
    await assert.rejects(() => criarTarefa("x", { titulo: "Roçar", observacao: "", prazo: "" }), /não encontrado/);
    await assert.rejects(() => criarNota("x", "texto"), /não encontrado/);
  });

  it("cria e exclui observações com a data de hoje", async () => {
    const l = await novoLote("A");
    const n = await criarNota(l.id, "  Capim bem formado  ");
    assert.equal(n.texto, "Capim bem formado");
    assert.equal(n.data, hoje());
    await assert.rejects(() => criarNota(l.id, "   "), /Escreva/);
    await excluirNota(n.id);
    assert.ok((await db.notas.get(n.id))?.deletedAt);
  });
});
