// Testes de mover algumas cabeças entre lotes. Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { totalCabecas } from "./composicao";
import { db } from "./db";
import { criarCabeca, criarLoteGado, loteGadoPorId } from "./gado";
import { registrarParto } from "./partos";
import { moverCabecas } from "./transferencia";
import type { LinhaComposicao } from "./types";
import { hoje } from "./utils";

const lote = (nome: string, composicao: LinhaComposicao[], pastoId: string | null = null) =>
  criarLoteGado({ nome, pastoId, composicao, raca: "Nelore", pesoMedioKg: null, origem: "", situacao: "Normal", vacinas: [], observacoes: "" });
const qtd = (c: LinhaComposicao[], cat: string) => c.find((l) => l.categoria === cat)?.quantidade ?? 0;

beforeEach(async () => {
  await Promise.all([db.pastos.clear(), db.lotesGado.clear(), db.cabecas.clear(), db.partos.clear()]);
});

describe("mover algumas cabeças", () => {
  it("para lote existente soma no destino e tira da origem", async () => {
    const a = await lote("A", [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 10 }, { sexo: "Macho", categoria: "Garrote", quantidade: 4 }]);
    const b = await lote("B", [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 2 }]);
    await moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 3 }, { sexo: "Macho", categoria: "Garrote", quantidade: 4 }], [], { tipo: "lote", loteId: b.id });
    const ca = (await loteGadoPorId(a.id)).composicao;
    const cb = (await loteGadoPorId(b.id)).composicao;
    assert.equal(qtd(ca, "Novilha"), 7);
    assert.equal(qtd(ca, "Garrote"), 0);
    assert.equal(qtd(cb, "Novilha"), 5);
    assert.equal(qtd(cb, "Garrote"), 4);
  });

  it("lote novo nasce no mesmo pasto; nome repetido é recusado", async () => {
    const pasto = "pasto-x";
    const a = await lote("A", [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 5 }], null);
    await db.lotesGado.update(a.id, { pastoId: pasto });
    const novo = await moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 2 }], [], { tipo: "novo", nome: "Separadas" });
    assert.equal(novo.pastoId, pasto);
    assert.equal(totalCabecas(novo.composicao), 2);
    await assert.rejects(() => moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 1 }], [], { tipo: "novo", nome: "separadas" }), /Já existe/);
  });

  it("recusa mais do que existe, tudo, o mesmo lote e nada", async () => {
    const a = await lote("A", [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 3 }]);
    const b = await lote("B", [{ sexo: "Macho", categoria: "Boi", quantidade: 1 }]);
    const novilha = (n: number) => [{ sexo: "Fêmea" as const, categoria: "Novilha", quantidade: n }];
    await assert.rejects(() => moverCabecas(a.id, novilha(4), [], { tipo: "lote", loteId: b.id }), /não tem 4/);
    await assert.rejects(() => moverCabecas(a.id, novilha(3), [], { tipo: "lote", loteId: b.id }), /mova o lote inteiro/);
    await assert.rejects(() => moverCabecas(a.id, novilha(1), [], { tipo: "lote", loteId: a.id }), /diferente/);
    await assert.rejects(() => moverCabecas(a.id, novilha(0), [], { tipo: "lote", loteId: b.id }), /Escolha quantas/);
    assert.equal(totalCabecas((await loteGadoPorId(a.id)).composicao), 3);
  });

  it("cabeças cadastradas marcadas vão junto e precisam combinar com o sexo", async () => {
    const a = await lote("A", [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 4 }, { sexo: "Macho", categoria: "Garrote", quantidade: 2 }]);
    const b = await lote("B", [{ sexo: "Macho", categoria: "Boi", quantidade: 1 }]);
    const nova = (cor: string, sexo: "Fêmea" | "Macho") =>
      criarCabeca(a.id, { brinco: "", cor, nome: "", raca: "", sexo, dataNascimento: "", pesoKg: null, mae: "", pai: "", observacoes: "" });
    const f1 = await nova("Branca", "Fêmea");
    const m1 = await nova("Preta", "Macho");
    // marcou um macho cadastrado mas só saem fêmeas
    await assert.rejects(
      () => moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 2 }], [m1.id], { tipo: "lote", loteId: b.id }),
      /machos cadastrados/
    );
    await moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 2 }], [f1.id], { tipo: "lote", loteId: b.id });
    assert.equal((await db.cabecas.get(f1.id))?.loteGadoId, b.id);
    assert.equal((await db.cabecas.get(m1.id))?.loteGadoId, a.id);
  });

  it("cabeças cadastradas que ficam não podem passar do total da origem", async () => {
    const a = await lote("A", [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 3 }]);
    const b = await lote("B", [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 1 }]);
    for (const cor of ["Branca", "Preta", "Malhada"]) {
      await criarCabeca(a.id, { brinco: "", cor, nome: "", raca: "", sexo: "Fêmea", dataNascimento: "", pesoKg: null, mae: "", pai: "", observacoes: "" });
    }
    await assert.rejects(
      () => moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 2 }], [], { tipo: "lote", loteId: b.id }),
      /passariam do total/
    );
  });

  it("bezerro mamando e vaca parida com bezerro só saem pela desmama", async () => {
    const a = await lote("A", [{ sexo: "Fêmea", categoria: "Vaca mojando", quantidade: 2 }, { sexo: "Fêmea", categoria: "Novilha", quantidade: 1 }]);
    const b = await lote("B", [{ sexo: "Macho", categoria: "Boi", quantidade: 1 }]);
    await registrarParto(a.id, { data: hoje(), sexoBezerro: "Fêmea", vaca: {} });
    // composição: mojando 1, parida 1, bezerra 1, novilha 1
    await assert.rejects(() => moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Bezerra", quantidade: 1 }], [], { tipo: "lote", loteId: b.id }), /Desmamar/);
    await assert.rejects(() => moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Vaca parida", quantidade: 1 }], [], { tipo: "lote", loteId: b.id }), /Desmamar/);
    await moverCabecas(a.id, [{ sexo: "Fêmea", categoria: "Vaca mojando", quantidade: 1 }], [], { tipo: "lote", loteId: b.id });
    assert.equal(qtd((await loteGadoPorId(b.id)).composicao, "Vaca mojando"), 1);
  });
});
