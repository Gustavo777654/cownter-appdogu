// Testes de Recursos: estoque, reposição, uso ao marcar sal/remédio e alertas. Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { db } from "./db";
import { coletarAlertasEstoque, consumoMedio, diasDeEstoque } from "./estoque";
import { criarPasto } from "./pastos";
import { atualizarRecurso, corrigirEstoque, criarRecurso, excluirRecurso, registrarUsoRotina, reporEstoque } from "./recursos";
import { addDias } from "./rotinas";
import type { UsoRecurso } from "./types";
import { hoje } from "./utils";

const sal = (nome = "Sal mineral", estoque: number | null = 10) =>
  criarRecurso({ tipo: "Suplemento", nome, kgPorSaco: 25, precoUnitario: 100, estoqueMinimo: 3 }, estoque);
const remedio = (nome = "Ripercol", estoque: number | null = 5) =>
  criarRecurso({ tipo: "Remédio", nome, kgPorSaco: null, precoUnitario: 50, estoqueMinimo: null }, estoque);
const pasto = () => criarPasto({ nome: "Norte", areaHa: 10, nivelPasto: "Médio" });

beforeEach(async () => {
  await Promise.all([db.pastos.clear(), db.recursos.clear(), db.comprasRecurso.clear(), db.usosRecurso.clear()]);
});

describe("cadastro", () => {
  it("estoque inicial vira a primeira compra", async () => {
    const r = await sal();
    assert.equal(r.estoque, 10);
    const compras = await db.comprasRecurso.toArray();
    assert.equal(compras.length, 1);
    assert.equal(compras[0].total, 1000);
  });

  it("valida nome, kg do saco, nome repetido por tipo", async () => {
    await assert.rejects(() => criarRecurso({ tipo: "Suplemento", nome: " ", kgPorSaco: 25, precoUnitario: null, estoqueMinimo: null }, 1), /nome/);
    await assert.rejects(() => criarRecurso({ tipo: "Suplemento", nome: "X", kgPorSaco: null, precoUnitario: null, estoqueMinimo: null }, 1), /kg/);
    await assert.rejects(() => criarRecurso({ tipo: "Suplemento", nome: "X", kgPorSaco: 0, precoUnitario: null, estoqueMinimo: null }, 1), /maiores que zero/);
    await sal("Sal");
    await assert.rejects(() => sal("sal"), /Já existe/);
    await remedio("Sal"); // outro tipo pode ter o mesmo nome
  });

  it("editar não mexe no estoque; corrigir estoque não gera compra", async () => {
    const r = await sal();
    await atualizarRecurso(r.id, { tipo: "Suplemento", nome: "Sal 25", kgPorSaco: 30, precoUnitario: 110, estoqueMinimo: 2 });
    let a = await db.recursos.get(r.id);
    assert.equal(a?.estoque, 10);
    assert.equal(a?.kgPorSaco, 30);
    await corrigirEstoque(r.id, 7.5);
    a = await db.recursos.get(r.id);
    assert.equal(a?.estoque, 7.5);
    assert.equal(await db.comprasRecurso.count(), 1);
  });
});

describe("repor estoque", () => {
  it("soma, guarda a compra e atualiza o preço", async () => {
    const r = await sal();
    await reporEstoque(r.id, { data: hoje(), quantidade: 4.5, precoUnitario: 120 });
    const a = await db.recursos.get(r.id);
    assert.equal(a?.estoque, 14.5);
    assert.equal(a?.precoUnitario, 120);
    const compras = await db.comprasRecurso.where("recursoId").equals(r.id).toArray();
    assert.equal(compras.length, 2);
    assert.ok(compras.some((c) => c.total === 540));
  });

  it("recusa data futura e quantidade zero", async () => {
    const r = await sal();
    await assert.rejects(() => reporEstoque(r.id, { data: "2999-01-01", quantidade: 1, precoUnitario: null }), /futuro/);
    await assert.rejects(() => reporEstoque(r.id, { data: hoje(), quantidade: 0, precoUnitario: null }), /maior que zero/);
  });
});

describe("uso ao marcar feito", () => {
  it("baixa decimal, registra o uso com custo e marca o sal do pasto como feito hoje", async () => {
    const p = await pasto();
    const r = await sal();
    await registrarUsoRotina(p.id, "sal", [{ recursoId: r.id, quantidade: 1.5 }]);
    assert.equal((await db.recursos.get(r.id))?.estoque, 8.5);
    const usos = await db.usosRecurso.toArray();
    assert.equal(usos.length, 1);
    assert.equal(usos[0].custo, 150);
    assert.equal((await db.pastos.get(p.id))?.salUltimaData, hoje());
  });

  it("vários itens de uma vez no remédio", async () => {
    const p = await pasto();
    const a = await remedio("Ripercol", 3);
    const b = await remedio("Ivermectina", 2);
    await registrarUsoRotina(p.id, "remedio", [{ recursoId: a.id, quantidade: 0.5 }, { recursoId: b.id, quantidade: 1 }]);
    assert.equal((await db.recursos.get(a.id))?.estoque, 2.5);
    assert.equal((await db.recursos.get(b.id))?.estoque, 1);
    assert.equal((await db.pastos.get(p.id))?.remedioUltimaData, hoje());
  });

  it("tudo ou nada: estoque insuficiente, tipo errado ou item repetido não alteram nada", async () => {
    const p = await pasto();
    const s = await sal("Sal", 2);
    const r = await remedio("Rem", 5);
    await assert.rejects(() => registrarUsoRotina(p.id, "remedio", [{ recursoId: r.id, quantidade: 1 }, { recursoId: s.id, quantidade: 1 }]), /não serve/);
    await assert.rejects(() => registrarUsoRotina(p.id, "sal", [{ recursoId: s.id, quantidade: 3 }]), /tem só/);
    await assert.rejects(() => registrarUsoRotina(p.id, "sal", [{ recursoId: s.id, quantidade: 0 }]), /maior que zero/);
    await assert.rejects(() => registrarUsoRotina(p.id, "sal", [{ recursoId: s.id, quantidade: 1 }, { recursoId: s.id, quantidade: 1 }]), /duas vezes/);
    await assert.rejects(() => registrarUsoRotina(p.id, "sal", []), /pelo menos um/);
    assert.equal((await db.recursos.get(s.id))?.estoque, 2);
    assert.equal((await db.recursos.get(r.id))?.estoque, 5);
    assert.equal(await db.usosRecurso.count(), 0);
    assert.equal((await db.pastos.get(p.id))?.remedioUltimaData, "");
  });

  it("não deixa a conta decimal virar 0,30000000000000004", async () => {
    const p = await pasto();
    const s = await sal("Sal", 0.3);
    await registrarUsoRotina(p.id, "sal", [{ recursoId: s.id, quantidade: 0.1 }]);
    await registrarUsoRotina(p.id, "sal", [{ recursoId: s.id, quantidade: 0.2 }]);
    assert.equal((await db.recursos.get(s.id))?.estoque, 0);
  });

  it("item excluído não pode ser usado", async () => {
    const p = await pasto();
    const s = await sal();
    await excluirRecurso(s.id);
    await assert.rejects(() => registrarUsoRotina(p.id, "sal", [{ recursoId: s.id, quantidade: 1 }]), /não encontrado/);
  });
});

describe("alertas de estoque", () => {
  const uso = (recursoId: string, dias: number, quantidade: number): UsoRecurso => ({
    id: Math.random().toString(), recursoId, pastoId: "p", rotina: "sal", data: addDias(hoje(), -dias)!, quantidade, custo: null,
    createdAt: "", updatedAt: "", deletedAt: null, syncStatus: "pending",
  });

  it("consumo médio precisa de 2 usos e usa os dias desde o primeiro", () => {
    assert.equal(consumoMedio("a", [uso("a", 10, 2)], hoje()), null);
    const c = consumoMedio("a", [uso("a", 10, 2), uso("a", 0, 3)], hoje());
    assert.equal(c?.porDia, 0.5); // 5 sacos em 10 dias
    assert.equal(diasDeEstoque(5, c), 10);
    assert.equal(consumoMedio("a", [uso("a", 200, 2), uso("a", 150, 3)], hoje()), null); // fora da janela
  });

  it("avisa zerado, abaixo do mínimo e previsão de acabar; respeita o prazo escolhido", async () => {
    const a = await sal("Sal A", 2); // mínimo 3 -> baixo
    const b = await sal("Sal B", 10);
    const c = await sal("Sal C", 0);
    const d = await sal("Sal D", 8);
    const recs = await db.recursos.toArray();
    const usos = [uso(b.id, 10, 2), uso(b.id, 0, 3), uso(d.id, 10, 1), uso(d.id, 0, 1)]; // B: 0,5/dia -> 20 dias; D: 0,2/dia -> 40 dias
    const al15 = coletarAlertasEstoque(recs, usos, hoje(), 15);
    assert.deepEqual(al15.map((x) => x.nome), ["Sal A", "Sal C"]);
    assert.ok(al15.every((x) => x.grave));
    const al30 = coletarAlertasEstoque(recs, usos, hoje(), 30);
    assert.deepEqual(al30.map((x) => x.nome), ["Sal A", "Sal C", "Sal B"]);
    assert.equal(al30[2].grave, false);
    assert.ok(a && c);
  });
});
