// Testes do aluguel de pasto. Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { coletarAlertasAluguel, fimDoAluguel, parcelasDoAluguel, renovarAluguel, vencimentoDaParcela } from "./aluguel";
import { db } from "./db";
import { atualizarPasto, criarPasto } from "./pastos";
import type { AluguelPasto } from "./types";
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

  it("antecipado vence no começo de cada mês; no final vence no último dia", () => {
    const a: AluguelPasto = { valorMensal: 1500, inicio: "2026-11-01", meses: 3 };
    assert.deepEqual(parcelasDoAluguel(a).map((p) => p.vencimento), ["2026-11-01", "2026-12-01", "2027-01-01"]);
    const f: AluguelPasto = { ...a, pagamento: "final" };
    assert.deepEqual(parcelasDoAluguel(f).map((p) => p.vencimento), ["2026-11-30", "2026-12-31", "2027-01-31"]);
    assert.equal(vencimentoDaParcela({ ...f, inicio: "2026-03-10" }, 0), "2026-04-09");
  });

  it("o gasto só entra em Finanças depois de pago, no mês da data do pagamento", () => {
    const aluguel: AluguelPasto = { valorMensal: 1500, inicio: "2026-09-10", meses: 3, pagamentos: { "0": "2026-09-08", "1": "2026-11-02" } };
    const d = dados([{ id: "p1", nome: "Norte", deletedAt: null, aluguel }]);
    const hojeIso = "2026-11-05";
    const out = lancamentos(d, { ano: 2026, mes: null, pastoId: null }, hojeIso);
    assert.equal(out.length, 2); // a parcela de novembro ainda não foi paga
    assert.equal(lancamentos(d, { ano: 2026, mes: 9, pastoId: null }, hojeIso).length, 1);
    assert.equal(lancamentos(d, { ano: 2026, mes: 10, pastoId: null }, hojeIso).length, 0); // vencida em outubro, paga em novembro
    assert.equal(lancamentos(d, { ano: 2026, mes: 11, pastoId: null }, hojeIso).length, 1);
    assert.equal(lancamentos(d, { ano: 2026, mes: null, pastoId: "outro" }, hojeIso).length, 0);
    assert.deepEqual(saidasPorCategoria(out), [{ categoria: "Aluguel de pasto", valor: 3000 }]);
    assert.deepEqual(custoPorPasto(d, { ano: 2026, mes: null }, hojeIso), [{ pastoId: "p1", valor: 3000 }]);
  });

  it("duas parcelas pagas no mesmo dia viram dois lançamentos com chaves diferentes", () => {
    const aluguel: AluguelPasto = { valorMensal: 100, inicio: "2026-09-01", meses: 3, pagamentos: { "0": "2026-11-02", "1": "2026-11-02" } };
    const out = lancamentos(dados([{ id: "p1", nome: "N", deletedAt: null, aluguel }]), { ano: 2026, mes: 11, pastoId: null }, "2026-11-05");
    assert.equal(out.length, 2);
    assert.notEqual(out[0].chave, out[1].chave);
  });

  it("renovar soma meses ao prazo e valida", () => {
    const a: AluguelPasto = { valorMensal: 100, inicio: "2026-11-01", meses: null, pagamentos: { "0": "2026-11-01" } };
    const r = renovarAluguel(a, 12);
    assert.equal(r.meses, 13);
    assert.deepEqual(r.pagamentos, { "0": "2026-11-01" });
    assert.equal(fimDoAluguel(r), "2027-11-30");
    assert.equal(parcelasDoAluguel(r).length, 13);
    assert.throws(() => renovarAluguel(a, 0));
    assert.throws(() => renovarAluguel(a, 1.5));
    assert.throws(() => renovarAluguel(r, 120));
  });

  it("o pagamento (antecipado/final) é salvo no pasto", async () => {
    const p = await criarPasto({ nome: "Leste", areaHa: null, nivelPasto: "Alto", aluguel: { valorMensal: 800, inicio: "2026-11-01", meses: null, pagamento: "final" } });
    assert.equal((await db.pastos.get(p.id))?.aluguel?.pagamento, "final");
    const q = await criarPasto({ nome: "Oeste", areaHa: null, nivelPasto: "Alto", aluguel: { valorMensal: 800, inicio: "2026-11-01", meses: null } });
    assert.equal((await db.pastos.get(q.id))?.aluguel?.pagamento, "antecipado");
  });

  it("avisa 7 dias antes de terminar e depois que venceu", () => {
    const p = (inicio: string, meses: number | null) => ({ id: "p", nome: "Norte", deletedAt: null, aluguel: { valorMensal: 1, inicio, meses, pagamentos: { "0": inicio } } });
    const fim = (lista: ReturnType<typeof coletarAlertasAluguel>) => lista.filter((a) => a.tipo === "fim");
    // fim em 2026-11-30
    assert.equal(fim(coletarAlertasAluguel([p("2026-11-01", null)], "2026-11-22")).length, 0);
    const em7 = fim(coletarAlertasAluguel([p("2026-11-01", null)], "2026-11-23"));
    assert.equal(em7.length, 1);
    assert.equal(em7[0].dias, 7);
    const venceu = fim(coletarAlertasAluguel([p("2026-11-01", null)], "2026-12-02"));
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

describe("reajuste do aluguel", () => {
  const base = { valorMensal: 1000, inicio: "2026-08-10", meses: 6 };
  it("a partir de uma data não muda os meses anteriores", async () => {
    const { reajustarAluguel, valorDaParcela } = await import("./aluguel");
    const a = reajustarAluguel(base, 1200, { desde: "2026-10-10" });
    assert.equal(valorDaParcela(a, "2026-08-10"), 1000);
    assert.equal(valorDaParcela(a, "2026-09-10"), 1000);
    assert.equal(valorDaParcela(a, "2026-10-10"), 1200);
    assert.equal(valorDaParcela(a, "2026-11-10"), 1200);
    const b = reajustarAluguel(a, 1500, { desde: "2026-11-10" });
    assert.equal(valorDaParcela(b, "2026-10-10"), 1200);
    assert.equal(valorDaParcela(b, "2026-11-10"), 1500);
  });
  it("desde o início muda todas as parcelas", async () => {
    const { reajustarAluguel, valorDaParcela } = await import("./aluguel");
    const a = reajustarAluguel(reajustarAluguel(base, 1200, { desde: "2026-10-10" }), 900, "inicio");
    assert.equal(valorDaParcela(a, "2026-08-10"), 900);
    assert.equal(valorDaParcela(a, "2026-11-10"), 900);
  });
  it("Finanças usa o valor de cada mês", async () => {
    const { reajustarAluguel } = await import("./aluguel");
    const a = { ...reajustarAluguel(base, 1200, { desde: "2026-10-10" }), pagamentos: { "0": "2026-09-10", "1": "2026-10-10", "2": "2026-11-10", "3": "2026-12-10" } };
    const d = dados([{ id: "p", nome: "N", deletedAt: null, aluguel: a }]);
    const l = lancamentos(d, { ano: 2026, mes: null, pastoId: null }, "2026-12-12");
    assert.deepEqual(l.map((x) => x.valor), [1000, 1000, 1200, 1200]);
  });
});

describe("pagamento do aluguel (parcela a parcela)", () => {
  const base: AluguelPasto = { valorMensal: 1000, inicio: "2026-09-10", meses: 4 };
  const pasto = (a: AluguelPasto) => [{ id: "p", nome: "Norte", deletedAt: null, aluguel: a }];

  it("lista as parcelas do início ao fim, com vencimento, valor e situação", async () => {
    const { parcelasDoAluguel } = await import("./aluguel");
    const l = parcelasDoAluguel({ ...base, pagamentos: { "1": "2026-10-12" } });
    assert.deepEqual(l.map((x) => x.vencimento), ["2026-09-10", "2026-10-10", "2026-11-10", "2026-12-10"]);
    assert.equal(l[1].pagoEm, "2026-10-12");
    assert.equal(l[0].pagoEm, null);
  });

  it("registra e desfaz o pagamento, validando a data", async () => {
    const { registrarPagamento, desfazerPagamento } = await import("./aluguel");
    const a = registrarPagamento(base, 0, "2026-09-11", "2026-11-20");
    assert.equal(a.pagamentos?.["0"], "2026-09-11");
    assert.equal(base.pagamentos, undefined, "não altera o original");
    assert.equal(desfazerPagamento(a, 0).pagamentos?.["0"], undefined);
    assert.throws(() => registrarPagamento(base, 0, "2026-12-01", "2026-11-20"), /futuro/);
    assert.throws(() => registrarPagamento(base, 0, "", "2026-11-20"), /data do pagamento/);
    assert.throws(() => registrarPagamento(base, 9, "2026-11-01", "2026-11-20"), /não encontrada/);
  });

  it("avisa 'Aluguel a pagar' a partir do vencimento, até marcar como pago", () => {
    // antes do primeiro vencimento: nada a pagar
    assert.equal(coletarAlertasAluguel(pasto(base), "2026-09-09").filter((a) => a.tipo === "pagar").length, 0);
    // no dia do vencimento
    const hoje = coletarAlertasAluguel(pasto(base), "2026-09-10").filter((a) => a.tipo === "pagar");
    assert.equal(hoje.length, 1);
    assert.equal(hoje[0].dias, 0);
    assert.equal(hoje[0].titulo, "Aluguel a pagar");
    // três meses em aberto: um aviso só, pelo vencimento mais antigo
    const tres = coletarAlertasAluguel(pasto(base), "2026-11-20").filter((a) => a.tipo === "pagar");
    assert.equal(tres.length, 1);
    assert.equal(tres[0].emAberto, 3);
    assert.equal(tres[0].dias, -71);
    // pagando o mais antigo, o aviso passa a ser do seguinte
    const pagoUm = coletarAlertasAluguel(pasto({ ...base, pagamentos: { "0": "2026-09-10" } }), "2026-11-20").filter((a) => a.tipo === "pagar");
    assert.equal(pagoUm[0].emAberto, 2);
    assert.equal(pagoUm[0].fim, "2026-10-10");
    // tudo pago até hoje: sem aviso
    const tudo = { ...base, pagamentos: { "0": "2026-09-10", "1": "2026-10-10", "2": "2026-11-10" } };
    assert.equal(coletarAlertasAluguel(pasto(tudo), "2026-11-20").filter((a) => a.tipo === "pagar").length, 0);
  });

  it("os pagamentos ficam no pasto, sobrevivem à edição e não mudam as despesas de Finanças", async () => {
    const { marcarAluguelPago, desmarcarAluguelPago } = await import("./pastos");
    const p = await criarPasto({ nome: "Oeste", areaHa: null, nivelPasto: "Alto", aluguel: { valorMensal: 500, inicio: "2026-09-10", meses: 3 } });
    await marcarAluguelPago(p.id, 0, "2026-09-12");
    let salvo = await db.pastos.get(p.id);
    assert.equal(salvo?.aluguel?.pagamentos?.["0"], "2026-09-12");
    assert.equal(salvo?.syncStatus, "pending");
    // editar o pasto (nome, valor, meses) não apaga o que já foi pago
    await atualizarPasto(p.id, { nome: "Oeste 2", areaHa: null, nivelPasto: "Alto", aluguel: { ...salvo!.aluguel!, meses: 4 } });
    salvo = await db.pastos.get(p.id);
    assert.equal(salvo?.aluguel?.pagamentos?.["0"], "2026-09-12");
    assert.equal(salvo?.aluguel?.meses, 4);
    // a despesa continua no mês do vencimento
    const d = dados([{ id: p.id, nome: "Oeste 2", deletedAt: null, aluguel: salvo!.aluguel }]);
    assert.equal(lancamentos(d, { ano: 2026, mes: 9, pastoId: null }, "2026-11-20").length, 1);
    await desmarcarAluguelPago(p.id, 0);
    assert.equal((await db.pastos.get(p.id))?.aluguel?.pagamentos?.["0"], undefined);
    await assert.rejects(() => marcarAluguelPago(p.id, 0, "2999-01-01"), /futuro/);
    await assert.rejects(() => marcarAluguelPago("nao-existe", 0, "2026-09-12"));
  });
});
