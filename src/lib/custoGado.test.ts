// Testes do preço de compra do gado que já era da fazenda. Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { totalCabecas } from "./composicao";
import { custosPorLote, lotesSemPreco, resultadoDaVenda, resultadoDasVendas, statusPreco } from "./custoGado";
import { db } from "./db";
import { marcarNascidoNaFazenda, registrarCompra, registrarCustoAquisicao, registrarVenda } from "./financas";
import { criarLoteGado, loteGadoPorId } from "./gado";
import { lancamentos, totais } from "./resumoFinanceiro";
import type { LinhaComposicao } from "./types";
import { hoje } from "./utils";

const bois = (n: number): LinhaComposicao[] => [{ sexo: "Macho", categoria: "Boi", quantidade: n }];
const lote = (nome: string, n = 10) =>
  criarLoteGado({ nome, pastoId: null, composicao: bois(n), raca: "", pesoMedioKg: null, origem: "", situacao: "Normal", vacinas: [], observacoes: "" });
const movs = () => db.movimentacoes.filter((m) => !m.deletedAt).toArray();

beforeEach(async () => {
  await Promise.all([db.pastos.clear(), db.lotesGado.clear(), db.cabecas.clear(), db.partos.clear(), db.movimentacoes.clear(), db.recursos.clear(), db.comprasRecurso.clear(), db.usosRecurso.clear()]);
});

describe("preço de compra de gado antigo", () => {
  it("lança uma compra com data passada sem mudar as cabeças do lote", async () => {
    const l = await lote("Antigos", 10);
    const m = await registrarCustoAquisicao({ loteId: l.id, data: "2025-03-10", valor: { modo: "cabeca", porCabeca: 2500 }, cabecas: 10 });
    assert.equal(m.tipo, "Compra");
    assert.equal(m.valor, 25000);
    assert.equal(m.data, "2025-03-10");
    assert.equal(totalCabecas((await loteGadoPorId(l.id)).composicao), 10);
  });

  it("aparece como saída em Finanças na data da compra", async () => {
    const l = await lote("Antigos", 4);
    await registrarCustoAquisicao({ loteId: l.id, data: "2025-03-10", valor: { modo: "total", total: 8000 }, cabecas: 4 });
    const d = { movimentacoes: await movs(), comprasRecurso: [], usosRecurso: [], recursos: [] };
    assert.equal(totais(lancamentos(d, { ano: 2025, mes: 3, pastoId: null })).saidas, 8000);
    assert.equal(totais(lancamentos(d, { ano: 2026, mes: null, pastoId: null })).saidas, 0);
  });

  it("valida data futura, cabeças e valor", async () => {
    const l = await lote("Antigos", 5);
    const base = { loteId: l.id, data: "2025-01-01", valor: { modo: "total", total: 100 } as const, cabecas: 5 };
    await assert.rejects(registrarCustoAquisicao({ ...base, data: "2999-01-01" }), /futuro/);
    await assert.rejects(registrarCustoAquisicao({ ...base, data: "" }), /data/i);
    await assert.rejects(registrarCustoAquisicao({ ...base, cabecas: 0 }), /cabeças/);
    await assert.rejects(registrarCustoAquisicao({ ...base, cabecas: 6 }), /mais cabeças/);
    await assert.rejects(registrarCustoAquisicao({ ...base, valor: { modo: "total", total: 0 } }), /valor/i);
  });

  it("lote sem compra aparece como sem preço; com compra ou nascido não", async () => {
    const a = await lote("A");
    const b = await lote("B");
    const c = await lote("C");
    await registrarCustoAquisicao({ loteId: b.id, data: "2025-01-01", valor: { modo: "total", total: 100 }, cabecas: 10 });
    await marcarNascidoNaFazenda(c.id, true);
    const lotes = await db.lotesGado.toArray();
    const sem = lotesSemPreco(lotes, await movs());
    assert.deepEqual(sem.map((l) => l.nome), ["A"]);
    const custos = custosPorLote(await movs());
    assert.equal(statusPreco(await loteGadoPorId(b.id), custos), "comprado");
    assert.equal(statusPreco(await loteGadoPorId(c.id), custos), "nascido");
    assert.equal(statusPreco(a, custos), "sem");
  });

  it("compra normal de lote novo já conta como tendo preço", async () => {
    const r = await registrarCompra({
      destino: { tipo: "novo", nome: "Novo", pastoId: null, raca: "" }, itens: [{ sexo: "Macho", categoria: "Boi", quantidade: 5 }],
      data: hoje(), valor: { modo: "total", total: 10000 }, vendedor: "", observacoes: "",
    });
    assert.equal(lotesSemPreco(await db.lotesGado.toArray(), await movs()).length, 0);
    assert.equal(custosPorLote(await movs()).get(r.lote.id)?.porCabeca, 2000);
  });

  it("resultado da venda usa o custo médio por cabeça", async () => {
    const l = await lote("Antigos", 10);
    await registrarCustoAquisicao({ loteId: l.id, data: "2025-01-01", valor: { modo: "total", total: 20000 }, cabecas: 10 });
    const v = await registrarVenda({
      loteId: l.id, itens: [{ sexo: "Macho", categoria: "Boi", quantidade: 4 }], cabecaIds: [], data: hoje(),
      valor: { modo: "total", total: 12000 }, comprador: "", observacoes: "",
    });
    const custos = custosPorLote(await movs());
    const r = resultadoDaVenda(v, await db.lotesGado.toArray(), custos);
    assert.deepEqual(r, { receita: 12000, custo: 8000, lucro: 4000 });
  });

  it("venda de lote sem preço não tem lucro e fica fora da soma; nascido tem custo zero", async () => {
    const a = await lote("Sem preço", 2);
    const n = await lote("Nascidos", 2);
    await marcarNascidoNaFazenda(n.id, true);
    const venda = (id: string) =>
      registrarVenda({ loteId: id, itens: [{ sexo: "Macho", categoria: "Boi", quantidade: 2 }], cabecaIds: [], data: hoje(), valor: { modo: "total", total: 5000 }, comprador: "", observacoes: "" });
    const va = await venda(a.id);
    const vn = await venda(n.id);
    const todos = await db.lotesGado.toArray(); // inclui os vendidos (excluídos)
    const custos = custosPorLote(await movs());
    assert.deepEqual(resultadoDaVenda(va, todos, custos), { receita: 5000, custo: null, lucro: null });
    assert.deepEqual(resultadoDaVenda(vn, todos, custos), { receita: 5000, custo: 0, lucro: 5000 });
    assert.deepEqual(resultadoDasVendas([va, vn], todos, custos), { receita: 5000, custo: 0, lucro: 5000, semPreco: 1 });
  });
});
