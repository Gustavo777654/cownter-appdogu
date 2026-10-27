// Testes de parto e desmama (IndexedDB simulado em memória). Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { totalCabecas } from "./composicao";
import { coletarAlertasDesmama, dataDesmama } from "./desmama";
import { db } from "./db";
import { criarCabeca, criarLoteGado, excluirLoteGado, loteGadoPorId } from "./gado";
import { desmamar, registrarParto } from "./partos";
import { addMeses } from "./rotinas";
import type { LinhaComposicao } from "./types";
import { hoje } from "./utils";

const matrizes = (composicao?: LinhaComposicao[]) =>
  criarLoteGado({
    nome: "Matrizes",
    pastoId: null,
    composicao: composicao ?? [
      { sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 5 },
      { sexo: "Fêmea", categoria: "Vaca mojando", quantidade: 2 },
      { sexo: "Macho", categoria: "Touro", quantidade: 1 },
    ],
    raca: "Nelore",
    pesoMedioKg: null,
    origem: "",
    situacao: "Normal",
    vacinas: [],
    observacoes: "",
  });

const qtd = (c: LinhaComposicao[], categoria: string) => c.find((l) => l.categoria === categoria)?.quantidade ?? 0;

beforeEach(async () => {
  await Promise.all([db.pastos.clear(), db.lotesGado.clear(), db.cabecas.clear(), db.partos.clear()]);
});

describe("registrar parto", () => {
  it("bezerro entra no lote e uma vaca mojando vira parida", async () => {
    const lote = await matrizes();
    await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Fêmea", vaca: "BR-001" });
    const c = (await loteGadoPorId(lote.id)).composicao;
    assert.equal(qtd(c, "Vaca mojando"), 1);
    assert.equal(qtd(c, "Vaca parida"), 1);
    assert.equal(qtd(c, "Bezerra"), 1);
    assert.equal(totalCabecas(c), 9);
  });

  it("sem vaca mojando usa a atrasada; sem nenhuma das duas recusa", async () => {
    const lote = await matrizes([{ sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 1 }]);
    await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Macho", vaca: "" });
    const c = (await loteGadoPorId(lote.id)).composicao;
    assert.equal(qtd(c, "Vaca atrasada"), 0);
    assert.equal(qtd(c, "Vaca parida"), 1);
    assert.equal(qtd(c, "Bezerro"), 1);
    await assert.rejects(
      () => registrarParto(lote.id, { data: hoje(), sexoBezerro: "Macho", vaca: "" }),
      /não tem vaca mojando ou atrasada/
    );
  });

  it("vaca parida cadastrada na composição (sem parto registrado) só recebe o bezerro", async () => {
    const lote = await matrizes([{ sexo: "Fêmea", categoria: "Vaca parida", quantidade: 2 }]);
    await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Fêmea", vaca: "" });
    const c = (await loteGadoPorId(lote.id)).composicao;
    assert.equal(qtd(c, "Vaca parida"), 2);
    assert.equal(qtd(c, "Bezerra"), 1);
  });

  it("recusa data futura e sexo inválido", async () => {
    const lote = await matrizes();
    await assert.rejects(
      () => registrarParto(lote.id, { data: "2999-01-01", sexoBezerro: "Fêmea", vaca: "" }),
      /futuro/
    );
    await assert.rejects(
      () => registrarParto(lote.id, { data: hoje(), sexoBezerro: "X" as never, vaca: "" }),
      /macho ou fêmea/
    );
  });
});

describe("desmamar", () => {
  it("cria lote novo no mesmo pasto e as mães voltam a atrasada", async () => {
    const lote = await matrizes();
    const a = await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Fêmea", vaca: "" });
    const b = await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Macho", vaca: "" });
    const { destino } = await desmamar(lote.id, [a.id, b.id], { tipo: "novo", nome: "Desmamados" });

    const origem = (await loteGadoPorId(lote.id)).composicao;
    assert.equal(qtd(origem, "Bezerra") + qtd(origem, "Bezerro"), 0);
    assert.equal(qtd(origem, "Vaca parida"), 0);
    assert.equal(qtd(origem, "Vaca atrasada"), 5 + 2);
    assert.equal(totalCabecas(origem), 8);

    const novo = await loteGadoPorId(destino.id);
    assert.equal(qtd(novo.composicao, "Bezerra"), 1);
    assert.equal(qtd(novo.composicao, "Bezerro"), 1);
    assert.equal((await db.partos.get(a.id))?.desmamado, true);
    assert.equal((await db.partos.get(a.id))?.destinoLoteId, destino.id);
  });

  it("pode juntar a um lote existente e recusa o próprio lote e nome repetido", async () => {
    const lote = await matrizes();
    const outro = await criarLoteGado({
      nome: "Garrotes", pastoId: null, composicao: [{ sexo: "Macho", categoria: "Bezerro", quantidade: 4 }],
      raca: "", pesoMedioKg: null, origem: "", situacao: "Normal", vacinas: [], observacoes: "",
    });
    const p = await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Macho", vaca: "" });
    await assert.rejects(() => desmamar(lote.id, [p.id], { tipo: "lote", loteId: lote.id }), /diferente/);
    await assert.rejects(() => desmamar(lote.id, [p.id], { tipo: "novo", nome: "garrotes" }), /Já existe/);
    await desmamar(lote.id, [p.id], { tipo: "lote", loteId: outro.id });
    assert.equal(qtd((await loteGadoPorId(outro.id)).composicao, "Bezerro"), 5);
    // desmamar de novo o mesmo bezerro é recusado
    await assert.rejects(() => desmamar(lote.id, [p.id], { tipo: "lote", loteId: outro.id }), /não está mais mamando/);
  });

  it("falha sem deixar nada pela metade", async () => {
    const lote = await matrizes();
    const p = await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Fêmea", vaca: "" });
    await assert.rejects(() => desmamar(lote.id, [p.id], { tipo: "novo", nome: "  " }), /nome do novo lote/);
    assert.equal((await db.partos.get(p.id))?.desmamado, false);
    assert.equal(qtd((await loteGadoPorId(lote.id)).composicao, "Bezerra"), 1);
  });

  it("respeita as cabeças cadastradas uma a uma", async () => {
    const lote = await matrizes([{ sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 1 }]);
    const p = await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Fêmea", vaca: "" });
    for (const cor of ["Branca", "Preta"]) {
      await criarCabeca(lote.id, {
        brinco: "", cor, nome: "", raca: "", sexo: "Fêmea", dataNascimento: "", pesoKg: null, mae: "", pai: "", observacoes: "",
      });
    }
    // total 2; depois da desmama ficaria 1 (< 2 cadastradas)
    await assert.rejects(() => desmamar(lote.id, [p.id], { tipo: "novo", nome: "Novo" }), /cadastradas individualmente/);
  });

  it("excluir o lote também exclui os partos", async () => {
    const lote = await matrizes();
    const p = await registrarParto(lote.id, { data: hoje(), sexoBezerro: "Fêmea", vaca: "" });
    await excluirLoteGado(lote.id);
    assert.ok((await db.partos.get(p.id))?.deletedAt);
  });
});

describe("aviso de desmama", () => {
  const parto = (loteGadoId: string, data: string, extra: object = {}) => ({
    id: Math.random().toString(), loteGadoId, data, sexoBezerro: "Fêmea" as const, vaca: "", desmamado: false,
    desmamadoEm: null, destinoLoteId: null, createdAt: "", updatedAt: "", deletedAt: null, syncStatus: "pending" as const, ...extra,
  });

  it("calcula a data pelo prazo escolhido", () => {
    assert.equal(dataDesmama("2026-01-31", 7), "2026-08-31");
    assert.equal(dataDesmama("2026-01-31", 1), "2026-02-28");
  });

  it("agrupa por lote, respeita a janela e ignora desmamados/excluídos", () => {
    const h = "2026-10-26";
    const lotes = [{ id: "A", nome: "Matrizes" }, { id: "B", nome: "Outro" }];
    const venceHoje = addMeses(h, -7)!;
    const venceEm30 = addMeses(addMeses(h, -7)!, 1)!; // ~30 dias
    const alertas = coletarAlertasDesmama(
      [
        parto("A", venceHoje),
        parto("A", addMeses(h, -8)!),
        parto("A", venceEm30),
        parto("B", venceHoje, { desmamado: true }),
        parto("B", venceHoje, { deletedAt: "x" }),
        parto("Z", venceHoje),
      ],
      lotes,
      h,
      7,
      7
    );
    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].loteId, "A");
    assert.equal(alertas[0].quantidade, 2);
    assert.ok(alertas[0].dias < 0);
  });
});
