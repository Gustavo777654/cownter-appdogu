// Testes do planejamento das notificações (parte pura, sem o plugin do Android).
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lerConfiguracao, type Configuracao } from "./config";
import { planejarNotificacoes, type DadosAvisos } from "./notificacoes";
import type { Pasto } from "./types";

function pasto(extra: Partial<Pasto> = {}): Pasto {
  return {
    id: "p1",
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
    syncStatus: "synced",
    ...extra,
  };
}

const vazio: DadosAvisos = { pastos: [], tarefas: [], partos: [], lotes: [], recursos: [], usos: [] };
const cfg: Configuracao = { ...lerConfiguracao(), notificacoesAtivas: true, notificacaoHora: 7 };
// 10/11/2026, 10h da manhã (horário local): o aviso das 7h de hoje já passou.
const agora = new Date(2026, 10, 10, 10, 0, 0);

describe("planejarNotificacoes", () => {
  it("não agenda nada quando não há avisos", () => {
    assert.deepEqual(planejarNotificacoes({ ...vazio, pastos: [pasto()] }, cfg, agora), []);
  });

  it("não agenda nada com as notificações desligadas", () => {
    const dados = { ...vazio, pastos: [pasto({ salUltimaData: "2026-10-01", salIntervaloDias: 10 })] };
    assert.deepEqual(planejarNotificacoes(dados, { ...cfg, notificacoesAtivas: false }, agora), []);
  });

  it("agenda o sal no dia certo, no horário escolhido", () => {
    const dados = { ...vazio, pastos: [pasto({ salUltimaData: "2026-11-05", salIntervaloDias: 10 })] };
    const plano = planejarNotificacoes(dados, { ...cfg, notificacaoHora: 8 }, agora);
    assert.ok(plano.length >= 1);
    const primeira = plano[0];
    assert.equal(primeira.quando.getHours(), 8);
    assert.equal(primeira.quando.getMinutes(), 0);
    assert.ok(primeira.quando.getTime() > agora.getTime());
    assert.match(primeira.corpo, /Pasto Norte/);
    assert.match(primeira.titulo, /aviso/);
  });

  it("nunca agenda para um horário que já passou", () => {
    const dados = { ...vazio, pastos: [pasto({ salUltimaData: "2026-10-01", salIntervaloDias: 10 })] };
    for (const n of planejarNotificacoes(dados, cfg, agora)) assert.ok(n.quando.getTime() > agora.getTime());
  });

  it("usa ids únicos e no máximo um aviso por dia", () => {
    const dados = { ...vazio, pastos: [pasto({ salUltimaData: "2026-10-01", salIntervaloDias: 10 })] };
    const plano = planejarNotificacoes(dados, cfg, agora);
    const ids = plano.map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length);
    const dias = plano.map((n) => n.quando.toDateString());
    assert.equal(new Set(dias).size, dias.length);
    assert.ok(plano.length <= 14);
  });
});
