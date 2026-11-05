// Testes de Finanças: venda, compra, despesa e resumos. Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { totalCabecas } from "./composicao";
import { db } from "./db";
import { excluirMovimentacao, registrarCompra, registrarDespesa, registrarVenda } from "./financas";
import { criarCabeca, criarLoteGado, loteGadoPorId } from "./gado";
import { criarPasto } from "./pastos";
import { registrarParto } from "./partos";
import { criarRecurso, registrarUsoRotina } from "./recursos";
import { custoPorPasto, lancamentos, porMes, saidasPorCategoria, totais, type DadosFinanceiros } from "./resumoFinanceiro";
import type { LinhaComposicao } from "./types";
import { hoje } from "./utils";

const lote = (nome: string, composicao: LinhaComposicao[], pastoId: string | null = null) =>
  criarLoteGado({ nome, pastoId, composicao, raca: "", pesoMedioKg: null, origem: "", situacao: "Normal", vacinas: [], observacoes: "" });
const bois = (n: number): LinhaComposicao[] => [{ sexo: "Macho", categoria: "Boi", quantidade: n }];
const venda = (loteId: string, qtd: number, extra: object = {}) =>
  registrarVenda({
    loteId, itens: [{ sexo: "Macho", categoria: "Boi", quantidade: qtd }], cabecaIds: [], data: hoje(),
    valor: { modo: "total", total: 1000 }, comprador: "", observacoes: "", ...extra,
  });

beforeEach(async () => {
  await Promise.all([db.pastos.clear(), db.lotesGado.clear(), db.cabecas.clear(), db.partos.clear(), db.movimentacoes.clear(), db.recursos.clear(), db.comprasRecurso.clear(), db.usosRecurso.clear()]);
});

describe("venda", () => {
  it("vender parte tira do lote e guarda o pasto, o lote e o valor", async () => {
    const p = await criarPasto({ nome: "Norte", areaHa: 1, nivelPasto: "Alto" });
    const l = await lote("Bois", bois(10), p.id);
    const m = await venda(l.id, 4, { valor: { modo: "cabeca", porCabeca: 3000 }, comprador: "Frigorífico X" });
    assert.equal(m.valor, 12000);
    assert.equal(m.cabecas, 4);
    assert.equal(m.pastoId, p.id);
    assert.equal(m.loteNome, "Bois");
    assert.equal(totalCabecas((await loteGadoPorId(l.id)).composicao), 6);
  });

  it("por arroba: preço da @ x total de @", async () => {
    const l = await lote("Bois", bois(5));
    const m = await venda(l.id, 2, { valor: { modo: "arroba", precoArroba: 300, arrobas: 36.5 } });
    assert.equal(m.valor, 10950);
    assert.equal(m.precoArroba, 300);
    assert.equal(m.arrobas, 36.5);
  });

  it("vender tudo encerra o lote, as cabeças cadastradas e os partos", async () => {
    const l = await lote("Bois", bois(2));
    const c = await criarCabeca(l.id, { brinco: "A1", cor: "", nome: "", raca: "", sexo: "Macho", dataNascimento: "", pesoKg: null, mae: "", pai: "", observacoes: "" });
    await venda(l.id, 2);
    assert.ok((await db.lotesGado.get(l.id))?.deletedAt);
    assert.ok((await db.cabecas.get(c.id))?.deletedAt);
  });

  it("recusa mais que o lote, valor zero, data futura e bezerro mamando", async () => {
    const l = await lote("Bois", bois(3));
    await assert.rejects(() => venda(l.id, 4), /não tem 4/);
    await assert.rejects(() => venda(l.id, 1, { valor: { modo: "total", total: 0 } }), /valor total/);
    await assert.rejects(() => venda(l.id, 1, { data: "2999-01-01" }), /futuro/);
    await assert.rejects(() => venda(l.id, 0), /Informe quantas/);
    assert.equal(totalCabecas((await loteGadoPorId(l.id)).composicao), 3);
    assert.equal(await db.movimentacoes.count(), 0);

    const m = await lote("Matrizes", [{ sexo: "Fêmea", categoria: "Vaca mojando", quantidade: 1 }]);
    await registrarParto(m.id, { data: hoje(), sexoBezerro: "Fêmea", vaca: {} });
    await assert.rejects(
      () => registrarVenda({ loteId: m.id, itens: [{ sexo: "Fêmea", categoria: "Bezerra", quantidade: 1 }], cabecaIds: [], data: hoje(), valor: { modo: "total", total: 100 }, comprador: "", observacoes: "" }),
      /desmama/
    );
  });

  it("cabeças cadastradas vendidas saem do rebanho", async () => {
    const l = await lote("Bois", bois(5));
    const c = await criarCabeca(l.id, { brinco: "A1", cor: "", nome: "", raca: "", sexo: "Macho", dataNascimento: "", pesoKg: null, mae: "", pai: "", observacoes: "" });
    await venda(l.id, 2, { cabecaIds: [c.id] });
    assert.ok((await db.cabecas.get(c.id))?.deletedAt);
    assert.equal(totalCabecas((await loteGadoPorId(l.id)).composicao), 3);
  });
});

describe("compra", () => {
  it("lote novo no pasto escolhido, com origem e valor por cabeça", async () => {
    const p = await criarPasto({ nome: "Sul", areaHa: 1, nivelPasto: "Médio" });
    const r = await registrarCompra({
      destino: { tipo: "novo", nome: "Garrotes comprados", pastoId: p.id, raca: "Nelore" },
      itens: [{ sexo: "Macho", categoria: "Garrote", quantidade: 20 }], data: hoje(),
      valor: { modo: "cabeca", porCabeca: 1800 }, vendedor: "Fazenda Boa Vista", observacoes: "",
    });
    assert.equal(r.movimentacao.valor, 36000);
    assert.equal(r.lote.pastoId, p.id);
    assert.equal(r.lote.origem, "Comprado de Fazenda Boa Vista");
    assert.equal(totalCabecas(r.lote.composicao), 20);
  });

  it("juntar a lote existente soma; nome repetido e pasto reservado são recusados sem registrar nada", async () => {
    const l = await lote("Bois", bois(10));
    await registrarCompra({ destino: { tipo: "lote", loteId: l.id }, itens: [{ sexo: "Macho", categoria: "Boi", quantidade: 5 }], data: hoje(), valor: { modo: "total", total: 5000 }, vendedor: "", observacoes: "" });
    assert.equal(totalCabecas((await loteGadoPorId(l.id)).composicao), 15);
    await assert.rejects(
      () => registrarCompra({ destino: { tipo: "novo", nome: "bois", pastoId: null, raca: "" }, itens: [{ sexo: "Macho", categoria: "Boi", quantidade: 1 }], data: hoje(), valor: { modo: "total", total: 1 }, vendedor: "", observacoes: "" }),
      /Já existe/
    );
    const reservado = await criarPasto({ nome: "Descanso", areaHa: 1, nivelPasto: "Baixo" });
    await db.pastos.update(reservado.id, { situacao: "Reservado" });
    await assert.rejects(
      () => registrarCompra({ destino: { tipo: "novo", nome: "Novo", pastoId: reservado.id, raca: "" }, itens: [{ sexo: "Macho", categoria: "Boi", quantidade: 1 }], data: hoje(), valor: { modo: "total", total: 1 }, vendedor: "", observacoes: "" }),
      /reservado/
    );
    assert.equal(await db.movimentacoes.count(), 1);
    assert.equal(await db.lotesGado.filter((x) => !x.deletedAt).count(), 1);
  });
});

describe("despesa e exclusão", () => {
  it("valida e registra; excluir só apaga o lançamento", async () => {
    const p = await criarPasto({ nome: "Norte", areaHa: 1, nivelPasto: "Alto" });
    await assert.rejects(() => registrarDespesa({ descricao: "", categoria: "Outros", valor: 10, data: hoje(), pastoId: null }), /Descreva/);
    await assert.rejects(() => registrarDespesa({ descricao: "x", categoria: "Inventada", valor: 10, data: hoje(), pastoId: null }), /categoria/);
    await assert.rejects(() => registrarDespesa({ descricao: "x", categoria: "Outros", valor: -5, data: hoje(), pastoId: null }), /maior que zero/);
    const m = await registrarDespesa({ descricao: "Arame", categoria: "Cerca e reforma", valor: 450.5, data: hoje(), pastoId: p.id });
    await excluirMovimentacao(m.id);
    assert.ok((await db.movimentacoes.get(m.id))?.deletedAt);
  });
});

describe("resumos", () => {
  async function dados(): Promise<DadosFinanceiros> {
    return {
      movimentacoes: await db.movimentacoes.toArray(),
      comprasRecurso: await db.comprasRecurso.toArray(),
      usosRecurso: await db.usosRecurso.toArray(),
      recursos: await db.recursos.toArray(),
    };
  }

  it("soma entradas e saídas, inclusive compras de estoque; por mês e categoria", async () => {
    const ano = Number(hoje().slice(0, 4));
    const mes = Number(hoje().slice(5, 7));
    const p = await criarPasto({ nome: "Norte", areaHa: 1, nivelPasto: "Alto" });
    const l = await lote("Bois", bois(10), p.id);
    await venda(l.id, 2, { valor: { modo: "total", total: 6000 } });
    await registrarCompra({ destino: { tipo: "lote", loteId: l.id }, itens: [{ sexo: "Macho", categoria: "Boi", quantidade: 1 }], data: hoje(), valor: { modo: "total", total: 2000 }, vendedor: "", observacoes: "" });
    await registrarDespesa({ descricao: "Vacina", categoria: "Veterinário", valor: 300, data: hoje(), pastoId: p.id });
    await criarRecurso({ tipo: "Suplemento", nome: "Sal", kgPorSaco: 25, precoUnitario: 100, estoqueMinimo: null }, 5); // R$ 500 de compra
    const d = await dados();
    const l1 = lancamentos(d, { ano, mes: null, pastoId: null });
    assert.deepEqual(totais(l1), { entradas: 6000, saidas: 2800, saldo: 3200 });
    assert.equal(porMes(l1)[mes - 1].saidas, 2800);
    const cats = saidasPorCategoria(l1);
    assert.deepEqual(cats.map((c) => c.categoria), ["Compra de gado", "Sal e suplementos", "Veterinário"]);
    assert.deepEqual(totais(lancamentos(d, { ano: ano - 1, mes: null, pastoId: null })), { entradas: 0, saidas: 0, saldo: 0 });
  });

  it("filtro de pasto usa o custo do sal gasto lá, não a compra do estoque; custo por pasto", async () => {
    const ano = Number(hoje().slice(0, 4));
    const a = await criarPasto({ nome: "A", areaHa: 1, nivelPasto: "Alto" });
    const b = await criarPasto({ nome: "B", areaHa: 1, nivelPasto: "Alto" });
    const sal = await criarRecurso({ tipo: "Suplemento", nome: "Sal", kgPorSaco: 25, precoUnitario: 100, estoqueMinimo: null }, 10);
    await registrarUsoRotina(a.id, "sal", [{ recursoId: sal.id, quantidade: 1.5 }]); // 150 no pasto A
    await registrarUsoRotina(b.id, "sal", [{ recursoId: sal.id, quantidade: 1 }]); // 100 no pasto B
    await registrarDespesa({ descricao: "Cerca", categoria: "Cerca e reforma", valor: 200, data: hoje(), pastoId: a.id });
    const d = await dados();
    assert.equal(totais(lancamentos(d, { ano, mes: null, pastoId: a.id })).saidas, 350);
    assert.equal(totais(lancamentos(d, { ano, mes: null, pastoId: null })).saidas, 1000 + 200); // compra de estoque + despesa
    const custo = custoPorPasto(d, { ano, mes: null });
    assert.deepEqual(custo, [{ pastoId: a.id, valor: 350 }, { pastoId: b.id, valor: 100 }]);
  });
});
