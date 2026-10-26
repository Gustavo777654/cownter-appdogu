// Testes das datas das rotinas e dos alertas (funções puras, sem banco).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDias,
  addMeses,
  coletarAlertas,
  descreverPrazo,
  diasEntre,
  diasParaVencer,
  proximaData,
} from "./rotinas";
import type { Pasto, Tarefa } from "./types";

function pasto(extra: Partial<Pasto> = {}): Pasto {
  return {
    id: "l1",
    nome: "Pasto Norte",
    areaHa: null,
    nivelPasto: "Alto",
    nivelEm: "2026-10-01",
    situacao: "Em uso",
    situacaoDesde: "2026-10-01",
    remedioUltimaData: "",
    remedioIntervaloMeses: null,
    salUltimaData: "",
    salIntervaloDias: null,
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
    syncStatus: "pending",
    ...extra,
  };
}

function tarefa(extra: Partial<Tarefa> = {}): Tarefa {
  return {
    id: "t1",
    pastoId: "l1",
    titulo: "Arrumar a cerca",
    observacao: "",
    prazo: "",
    feita: false,
    feitaEm: null,
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
    syncStatus: "pending",
    ...extra,
  };
}

describe("cálculo de datas", () => {
  it("soma dias atravessando mês e ano", () => {
    assert.equal(addDias("2026-10-23", 30), "2026-11-22");
    assert.equal(addDias("2026-12-20", 20), "2027-01-09");
    assert.equal(addDias("2026-03-01", -1), "2026-02-28");
  });

  it("soma meses mantendo o dia", () => {
    assert.equal(addMeses("2026-04-15", 6), "2026-10-15");
    assert.equal(addMeses("2026-10-15", 3), "2027-01-15");
    assert.equal(addMeses("2026-10-15", -6), "2026-04-15");
  });

  it("soma meses usando o último dia quando o mês de destino é menor", () => {
    assert.equal(addMeses("2026-01-31", 1), "2026-02-28");
    assert.equal(addMeses("2024-01-31", 1), "2024-02-29"); // ano bissexto
    assert.equal(addMeses("2026-08-31", 1), "2026-09-30");
  });

  it("conta dias entre datas, inclusive na virada do horário de verão", () => {
    assert.equal(diasEntre("2026-10-23", "2026-10-30"), 7);
    assert.equal(diasEntre("2026-10-30", "2026-10-23"), -7);
    assert.equal(diasEntre("2026-10-23", "2026-10-23"), 0);
    assert.equal(diasEntre("2018-11-01", "2018-11-10"), 9);
  });

  it("devolve null para datas inválidas", () => {
    assert.equal(addDias("", 1), null);
    assert.equal(addMeses("23/10/2026", 1), null);
    assert.equal(diasEntre("x", "2026-10-23"), null);
  });
});

describe("próxima vez da rotina", () => {
  it("remédio conta em meses e sal conta em dias", () => {
    assert.equal(proximaData("2026-04-23", "remedio", 6), "2026-10-23");
    assert.equal(proximaData("2026-10-01", "sal", 30), "2026-10-31");
  });

  it("sem última data ou sem intervalo não há próxima vez", () => {
    assert.equal(proximaData("", "sal", 30), null);
    assert.equal(proximaData("2026-10-01", "sal", null), null);
    assert.equal(proximaData("2026-10-01", "sal", 0), null);
  });

  it("descreve o prazo em português", () => {
    assert.equal(descreverPrazo(-5), "Atrasado há 5 dias");
    assert.equal(descreverPrazo(-1), "Atrasado há 1 dia");
    assert.equal(descreverPrazo(0), "Hoje");
    assert.equal(descreverPrazo(1), "Amanhã");
    assert.equal(descreverPrazo(10), "Em 10 dias");
    assert.equal(diasParaVencer("2026-10-30", "2026-10-23"), 7);
  });
});

describe("alertas da tela inicial", () => {
  const hoje = "2026-10-23";

  it("lista rotinas atrasadas, de hoje e dos próximos 7 dias, da mais urgente para a menos", () => {
    const l = pasto({
      remedioUltimaData: "2026-04-26", // +6 meses = 26/10 (daqui a 3 dias)
      remedioIntervaloMeses: 6,
      salUltimaData: "2026-09-18", // +30 dias = 18/10 (atrasado 5 dias)
      salIntervaloDias: 30,
    });
    const alertas = coletarAlertas([l], [], hoje);
    assert.deepEqual(
      alertas.map((a) => [a.tipo, a.dias]),
      [
        ["sal", -5],
        ["remedio", 3],
      ]
    );
    assert.equal(alertas[0].titulo, "Levar sal");
    assert.equal(alertas[1].titulo, "Dar remédio");
  });

  it("não mostra o que está longe (mais de 7 dias) nem rotina sem intervalo", () => {
    const l = pasto({
      remedioUltimaData: "2026-10-01",
      remedioIntervaloMeses: 6,
      salUltimaData: "2026-10-01", // sem intervalo
    });
    assert.deepEqual(coletarAlertas([l], [], hoje), []);
  });

  it("inclui tarefas abertas com prazo, e ignora concluídas, sem prazo e de pasto inexistente", () => {
    const alertas = coletarAlertas(
      [pasto()],
      [
        tarefa({ id: "a", titulo: "Jogar adubo", prazo: "2026-10-22" }),
        tarefa({ id: "b", titulo: "Roçar", prazo: "2026-10-25" }),
        tarefa({ id: "c", titulo: "Já feita", prazo: "2026-10-22", feita: true }),
        tarefa({ id: "d", titulo: "Sem prazo", prazo: "" }),
        tarefa({ id: "e", titulo: "Longe", prazo: "2026-12-01" }),
        tarefa({ id: "f", titulo: "Pasto sumiu", pastoId: "outro", prazo: "2026-10-22" }),
      ],
      hoje
    );
    assert.deepEqual(
      alertas.map((a) => a.titulo),
      ["Jogar adubo", "Roçar"]
    );
    assert.equal(alertas[0].dias, -1);
    assert.equal(alertas[0].pastoNome, "Pasto Norte");
  });
});
