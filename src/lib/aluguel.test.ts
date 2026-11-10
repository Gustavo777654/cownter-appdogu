// Testes do aluguel de pasto. Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { coletarAlertasAluguel, fimDoAluguel, parcelasAteHoje } from "./aluguel";
import { db } from "./db";
import { atualizarPasto, criarPasto } from "./pastos";
import { custoPorPasto, lancamentos, saidasPorCategoria, type DadosFinanceiros } from "./resumoFinanceiro";

beforeEach(async () => {
  await db.pastos.clear();
});

const dados = (pastos: DadosFinanceiros["pastos"]): DadosFinanceiros => ({ movimentacoes: [], comprasRecurso: [], usosRecurso: [], recursos: [], pastos });

describe("aluguel de pasto", () => {
  it("sem meses vale 1 mês e termina um dia antes do mesmo dia do mês seguinte", () => {
    assert.equal(fimDoAluguel({ valorMensal: 100, inicio: "2026-11-01", meses: null }), "2026-11-30");
    assert.equal(fimDoAluguel({ valorMensal: 100, inicio: "2026-03-10", meses: 6 }), "2026-09-09");
  });

  it("gera uma parcela por mês já começado, sem passar de hoje", () => {
    const a = { valorMensal: 1500, inicio: "2026-08-15", meses: 6 };
    assert.deepEqual(parcelasAteHoje(a, "2026-11-05"), ["2026-08-15", "2026-09-15", "2026-10-15"]);
    assert.deepEqual(parcelasAteHoje(a, "2026-08-14"), []);
    assert.equal(parcelasAteHoje(a, "2027-12-31").length, 6);
  });

  it("vira despesa Aluguel de pasto em Finanças, por mês e por pasto", () => {
    const d = dados([{ id: "p1", nome: "Norte", deletedAt: null, aluguel: { valorMensal: 1500, inicio: "2026-09-10", meses: 3 } }]);
    const hojeIso = "2026-11-05";
    const out = lancamentos(d, { ano: 2026, mes: null, pastoId: null }, hojeIso);
    assert.equal(out.length, 2);
    assert.equal(lancamentos(d, { ano: 2026, mes: 10, pastoId: null }, hojeIso).length, 1);
    assert.equal(lancamentos(d, { ano: 2026, mes: null, pastoId: "outro" }, hojeIso).length, 0);
    assert.deepEqual(saidasPorCategoria(out), [{ categoria: "Aluguel de pasto", valor: 3000 }]);
    assert.deepEqual(custoPorPasto(d, { ano: 2026, mes: null }, hojeIso), [{ pastoId: "p1", valor: 3000 }]);
  });

  it("avisa 7 dias antes de terminar e depois que venceu", () => {
    const p = (inicio: string, meses: number | null) => ({ id: "p", nome: "Norte", deletedAt: null, aluguel: { valorMensal: 1, inicio, meses } });
    // fim em 2026-11-30
    assert.equal(coletarAlertasAluguel([p("2026-11-01", null)], "2026-11-22").length, 0);
    const em7 = coletarAlertasAluguel([p("2026-11-01", null)], "2026-11-23");
    assert.equal(em7.length, 1);
    assert.equal(em7[0].dias, 7);
    const venceu = coletarAlertasAluguel([p("2026-11-01", null)], "2026-12-02");
    assert.equal(venceu[0].dias, -2);
    assert.equal(venceu[0].titulo, "Aluguel venceu");
  });

  it("salva e edita o aluguel no pasto e valida os dados", async () => {
    const p = await criarPasto({ nome: "Sul", areaHa: null, nivelPasto: "Alto", aluguel: { valorMensal: 800, inicio: "2026-11-01", meses: null } });
    assert.equal((await db.pastos.get(p.id))?.aluguel?.valorMensal, 800);
    await atualizarPasto(p.id, { nome: "Sul", areaHa: null, nivelPasto: "Alto", aluguel: null });
    assert.equal((await db.pastos.get(p.id))?.aluguel, null);
    await assert.rejects(() => atualizarPasto(p.id, { nome: "Sul", areaHa: null, nivelPasto: "Alto", aluguel: { valorMensal: 0, inicio: "2026-11-01", meses: null } }));
    await assert.rejects(() => atualizarPasto(p.id, { nome: "Sul", areaHa: null, nivelPasto: "Alto", aluguel: { valorMensal: 5, inicio: "2026-11-01", meses: 1.5 } }));
  });

  it("editar sem informar aluguel mantém o que já existe", async () => {
    const p = await criarPasto({ nome: "Leste", areaHa: null, nivelPasto: "Alto", aluguel: { valorMensal: 800, inicio: "2026-11-01", meses: 2 } });
    await atualizarPasto(p.id, { nome: "Leste 2", areaHa: null, nivelPasto: "Alto" });
    assert.equal((await db.pastos.get(p.id))?.aluguel?.meses, 2);
  });
});
