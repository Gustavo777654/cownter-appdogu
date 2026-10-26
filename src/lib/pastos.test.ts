// Testes dos pastos: rodízio de lotes, reserva, rotinas, tarefas e observações
// (IndexedDB simulado em memória). Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { db } from "./db";
import { criarLoteGado, moverLoteGado } from "./gado";
import {
  alterarSituacao,
  apagarTarefasFeitasAntigas,
  alternarTarefa,
  atualizarNivel,
  atualizarPasto,
  configurarRotina,
  criarNota,
  criarPasto,
  criarTarefa,
  excluirNota,
  excluirPasto,
  excluirTarefa,
  marcarRotinaFeita,
} from "./pastos";
import { addDias } from "./rotinas";
import { hoje } from "./utils";

const novoPasto = (nome: string) => criarPasto({ nome, areaHa: 10, nivelPasto: "Médio" });

const novoLote = (nome: string, pastoId: string | null = null) =>
  criarLoteGado({
    nome,
    pastoId,
    composicao: [{ sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 10 }],
    raca: "",
    pesoMedioKg: null,
    origem: "",
    situacao: "Normal",
    vacinas: [],
    observacoes: "",
  });

beforeEach(async () => {
  await Promise.all([
    db.pastos.clear(),
    db.lotesGado.clear(),
    db.cabecas.clear(),
    db.tarefas.clear(),
    db.notas.clear(),
  ]);
});

describe("pastos", () => {
  it("cria o pasto em uso, com nível, sem rotinas e marcado para sincronizar", async () => {
    const l = await novoPasto("  Pasto   Norte ");
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
    await novoPasto("Pasto Sul");
    await assert.rejects(() => novoPasto("   "), /nome/i);
    await assert.rejects(() => novoPasto("pasto sul"), /Já existe/);
    await assert.rejects(
      () => criarPasto({ nome: "X", areaHa: -3, nivelPasto: "Alto" }),
      /Área inválida/
    );
  });

  it("editar mantém o nome do próprio pasto e atualiza a data do nível só quando ele muda", async () => {
    const l = await novoPasto("Pasto Leste");
    await db.pastos.update(l.id, { nivelEm: "2020-01-01" });

    await atualizarPasto(l.id, { nome: "Pasto Leste", areaHa: 20, nivelPasto: "Médio" });
    assert.equal((await db.pastos.get(l.id))?.nivelEm, "2020-01-01");
    assert.equal((await db.pastos.get(l.id))?.areaHa, 20);

    await atualizarNivel(l.id, "Baixo");
    const depois = await db.pastos.get(l.id);
    assert.equal(depois?.nivelPasto, "Baixo");
    assert.equal(depois?.nivelEm, hoje());
  });
});

describe("rodízio: mover lotes e reservar pasto", () => {
  it("move o lote de um pasto para outro e marca para sincronizar", async () => {
    const a = await novoPasto("A");
    const b = await novoPasto("B");
    const x = await novoLote("Lote 1", a.id);
    await db.lotesGado.update(x.id, { syncStatus: "synced" });

    await moverLoteGado(x.id, b.id);
    const depois = await db.lotesGado.get(x.id);
    assert.equal(depois?.pastoId, b.id);
    assert.equal(depois?.syncStatus, "pending");
  });

  it("move para 'sem pasto'", async () => {
    const a = await novoPasto("A");
    const x = await novoLote("Lote 1", a.id);
    await moverLoteGado(x.id, null);
    assert.equal((await db.lotesGado.get(x.id))?.pastoId, null);
  });

  it("não deixa reservar um pasto que ainda tem lotes", async () => {
    const a = await novoPasto("A");
    await novoLote("Lote 1", a.id);
    await assert.rejects(() => alterarSituacao(a.id, "Reservado"), /1 lote de gado/);
    assert.equal((await db.pastos.get(a.id))?.situacao, "Em uso");
  });

  it("reserva o pasto vazio, marca desde quando e bloqueia a entrada de lotes", async () => {
    const a = await novoPasto("A");
    const b = await novoPasto("B");
    const x = await novoLote("Lote 1", a.id);

    await moverLoteGado(x.id, b.id);
    await db.pastos.update(a.id, { situacaoDesde: "2020-01-01" });
    await alterarSituacao(a.id, "Reservado");
    const reservado = await db.pastos.get(a.id);
    assert.equal(reservado?.situacao, "Reservado");
    assert.equal(reservado?.situacaoDesde, hoje());

    await assert.rejects(() => moverLoteGado(x.id, a.id), /reservado/);
    await assert.rejects(() => novoLote("Lote 2", a.id), /reservado/);

    await alterarSituacao(a.id, "Em uso");
    await moverLoteGado(x.id, a.id);
    assert.equal((await db.lotesGado.get(x.id))?.pastoId, a.id);
  });

  it("excluir o pasto deixa os lotes sem pasto e apaga tarefas e observações dele", async () => {
    const a = await novoPasto("A");
    const x = await novoLote("Lote 1", a.id);
    await criarTarefa(a.id, { titulo: "Roçar", observacao: "", prazo: "" });
    await criarNota(a.id, "Capim bom");

    await excluirPasto(a.id);

    assert.equal((await db.pastos.get(a.id))?.deletedAt !== null, true);
    assert.equal((await db.lotesGado.get(x.id))?.pastoId, null);
    assert.equal((await db.lotesGado.get(x.id))?.deletedAt, null);
    assert.equal((await db.tarefas.filter((t) => !t.deletedAt).toArray()).length, 0);
    assert.equal((await db.notas.filter((n) => !n.deletedAt).toArray()).length, 0);
    // o nome pode ser reaproveitado depois da exclusão
    await novoPasto("A");
  });
});

describe("rotinas de remédio e sal", () => {
  it("configura o remédio em meses e o sal em dias", async () => {
    const l = await novoPasto("A");
    await configurarRotina(l.id, "remedio", { ultimaData: "2026-04-23", intervalo: 6 });
    await configurarRotina(l.id, "sal", { ultimaData: "2026-10-01", intervalo: 30 });
    const depois = await db.pastos.get(l.id);
    assert.equal(depois?.remedioUltimaData, "2026-04-23");
    assert.equal(depois?.remedioIntervaloMeses, 6);
    assert.equal(depois?.salUltimaData, "2026-10-01");
    assert.equal(depois?.salIntervaloDias, 30);
  });

  it("valida data no futuro, intervalo e a falta da última data", async () => {
    const l = await novoPasto("A");
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
    const l = await novoPasto("A");
    await configurarRotina(l.id, "sal", { ultimaData: "2026-10-01", intervalo: 30 });
    await configurarRotina(l.id, "sal", { ultimaData: "", intervalo: null });
    const depois = await db.pastos.get(l.id);
    assert.equal(depois?.salUltimaData, "");
    assert.equal(depois?.salIntervaloDias, null);
  });

  it("'feito hoje' leva a última data para hoje e mantém o intervalo", async () => {
    const l = await novoPasto("A");
    await configurarRotina(l.id, "sal", { ultimaData: "2026-01-01", intervalo: 30 });
    await db.pastos.update(l.id, { syncStatus: "synced" });

    await marcarRotinaFeita(l.id, "sal");
    const depois = await db.pastos.get(l.id);
    assert.equal(depois?.salUltimaData, hoje());
    assert.equal(depois?.salIntervaloDias, 30);
    assert.equal(depois?.syncStatus, "pending");

    await marcarRotinaFeita(l.id, "remedio");
    assert.equal((await db.pastos.get(l.id))?.remedioUltimaData, hoje());
  });
});

describe("tarefas e observações", () => {
  it("cria, conclui, reabre e exclui tarefas", async () => {
    const l = await novoPasto("A");
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
    const l = await novoPasto("A");
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
    const l = await novoPasto("A");
    const n = await criarNota(l.id, "  Capim bem formado  ");
    assert.equal(n.texto, "Capim bem formado");
    assert.equal(n.data, hoje());
    await assert.rejects(() => criarNota(l.id, "   "), /Escreva/);
    await excluirNota(n.id);
    assert.ok((await db.notas.get(n.id))?.deletedAt);
  });
});

describe("mover lote para pasto reservado e apagar tarefas feitas antigas", () => {
  it("pasto reservado só recebe o lote com confirmação, e então volta a ficar em uso", async () => {
    const descanso = await novoPasto("Descanso");
    await alterarSituacao(descanso.id, "Reservado");
    const l = await novoLote("Lote X");

    await assert.rejects(() => moverLoteGado(l.id, descanso.id), /reservado/);
    assert.equal((await db.lotesGado.get(l.id))?.pastoId, null);

    await moverLoteGado(l.id, descanso.id, { liberarPastoReservado: true });
    assert.equal((await db.lotesGado.get(l.id))?.pastoId, descanso.id);
    const depois = await db.pastos.get(descanso.id);
    assert.equal(depois?.situacao, "Em uso");
    assert.equal(depois?.situacaoDesde, hoje());
  });

  it("a confirmação não muda pasto que não estava reservado", async () => {
    const p = await novoPasto("Normal");
    const l = await novoLote("Lote Y");
    await moverLoteGado(l.id, p.id, { liberarPastoReservado: true });
    const depois = await db.pastos.get(p.id);
    assert.equal(depois?.situacao, "Em uso");
    assert.equal(depois?.situacaoDesde, hoje());
  });

  it("apaga só as tarefas feitas há mais dias que o limite", async () => {
    const p = await novoPasto("Tarefas");
    const velha = await criarTarefa(p.id, { titulo: "Velha", observacao: "", prazo: "" });
    const nova = await criarTarefa(p.id, { titulo: "Nova", observacao: "", prazo: "" });
    const aberta = await criarTarefa(p.id, { titulo: "Aberta", observacao: "", prazo: "" });
    await alternarTarefa(velha.id);
    await alternarTarefa(nova.id);
    const agora = Date.now();
    await db.tarefas.update(velha.id, { feitaEm: new Date(agora - 40 * 86_400_000).toISOString() });
    await db.tarefas.update(nova.id, { feitaEm: new Date(agora - 5 * 86_400_000).toISOString() });

    assert.equal(await apagarTarefasFeitasAntigas(null, agora), 0);
    assert.equal(await apagarTarefasFeitasAntigas(30, agora), 1);
    assert.ok((await db.tarefas.get(velha.id))?.deletedAt);
    assert.equal((await db.tarefas.get(nova.id))?.deletedAt, null);
    assert.equal((await db.tarefas.get(aberta.id))?.deletedAt, null);
    assert.equal(await apagarTarefasFeitasAntigas(30, agora), 0);
  });
});
