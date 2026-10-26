// Testes dos lotes de gado: composição, vacinas, pasto e cabeças cadastradas uma a uma
// (IndexedDB simulado em memória). Rodar com: npm test
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { descreverCabecas, limparComposicao, resumoComposicao, totalCabecas, totalDeLotes } from "./composicao";
import { db } from "./db";
import {
  atualizarCabeca,
  atualizarLoteGado,
  criarCabeca,
  criarLoteGado,
  excluirCabeca,
  excluirLoteGado,
  moverLoteGado,
} from "./gado";
import { alterarSituacao, criarPasto } from "./pastos";
import type { CabecaInput, LoteGadoInput } from "./types";
import { addDias } from "./rotinas";
import { hoje } from "./utils";

const base: LoteGadoInput = {
  nome: "Lote A",
  pastoId: null,
  composicao: [{ sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 12 }],
  raca: "",
  pesoMedioKg: null,
  origem: "",
  situacao: "Normal",
  vacinas: [],
  observacoes: "",
};
const lote = (extra: Partial<LoteGadoInput> = {}) => criarLoteGado({ ...base, ...extra });
const pasto = (nome: string) => criarPasto({ nome, areaHa: 10, nivelPasto: "Alto" });

const cabecaBase: CabecaInput = {
  brinco: "BR-001",
  cor: "",
  nome: "",
  raca: "",
  sexo: "Fêmea",
  dataNascimento: "",
  pesoKg: null,
  mae: "",
  pai: "",
  observacoes: "",
};

beforeEach(async () => {
  await Promise.all([db.pastos.clear(), db.lotesGado.clear(), db.cabecas.clear()]);
});

describe("composição do lote", () => {
  it("soma as cabeças, junta linhas repetidas e descarta as zeradas", () => {
    const limpa = limparComposicao([
      { sexo: "Fêmea", categoria: "Novilha", quantidade: 5 },
      { sexo: "Fêmea", categoria: "Novilha", quantidade: 3 },
      { sexo: "Macho", categoria: "Touro", quantidade: 0 },
      { sexo: "Macho", categoria: "Garrote", quantidade: 2 },
    ]);
    assert.deepEqual(limpa, [
      { sexo: "Fêmea", categoria: "Novilha", quantidade: 8 },
      { sexo: "Macho", categoria: "Garrote", quantidade: 2 },
    ]);
    assert.equal(totalCabecas(limpa), 10);
    assert.equal(resumoComposicao(limpa), "8 novilha · 2 garrote");
    assert.equal(descreverCabecas(1), "1 cabeça");
    assert.equal(descreverCabecas(10), "10 cabeças");
  });

  it("rejeita categoria que não existe para o sexo, quantidade quebrada e lista vazia", () => {
    assert.throws(() => limparComposicao([{ sexo: "Macho", categoria: "Novilha", quantidade: 1 }]), /não existe para macho/);
    assert.throws(() => limparComposicao([{ sexo: "Fêmea", categoria: "Vitela", quantidade: 1.5 }]), /inteiro/);
    assert.throws(() => limparComposicao([{ sexo: "Fêmea", categoria: "Vitela", quantidade: -1 }]), /inteiro/);
    assert.throws(() => limparComposicao([{ sexo: "Fêmea", categoria: "Vitela", quantidade: 0 }]), /pelo menos uma/);
    assert.throws(() => limparComposicao([]), /pelo menos uma/);
  });

  it("totalDeLotes soma vários lotes", () => {
    assert.equal(
      totalDeLotes([
        { composicao: [{ sexo: "Macho", categoria: "Boi", quantidade: 4 }] },
        { composicao: [{ sexo: "Fêmea", categoria: "Vitela", quantidade: 6 }, { sexo: "Macho", categoria: "Bezerro", quantidade: 1 }] },
      ]),
      11
    );
  });
});

describe("lotes de gado", () => {
  it("cria o lote marcado para sincronizar, com o total de cabeças", async () => {
    const l = await lote({ nome: "  Matrizes   do Norte " });
    assert.equal(l.nome, "Matrizes do Norte");
    assert.equal(totalCabecas(l.composicao), 12);
    assert.equal(l.syncStatus, "pending");
    assert.equal(l.deletedAt, null);
    assert.match(l.id, /^[0-9a-f-]{36}$/);
  });

  it("aceita lote misto com os dois sexos", async () => {
    const l = await lote({
      composicao: [
        { sexo: "Fêmea", categoria: "Vaca parida", quantidade: 6 },
        { sexo: "Macho", categoria: "Touro", quantidade: 1 },
      ],
    });
    assert.equal(totalCabecas(l.composicao), 7);
  });

  it("exige nome, rejeita nome repetido e peso inválido", async () => {
    await lote({ nome: "Garrotes" });
    await assert.rejects(() => lote({ nome: "  " }), /nome/i);
    await assert.rejects(() => lote({ nome: "garrotes" }), /Já existe/);
    await assert.rejects(() => lote({ nome: "Outro", pesoMedioKg: -5 }), /Peso inválido/);
  });

  it("coloca o lote em um pasto, mas não em pasto reservado nem inexistente", async () => {
    const livre = await pasto("Livre");
    const descanso = await pasto("Descanso");
    await alterarSituacao(descanso.id, "Reservado");

    const l = await lote({ pastoId: livre.id });
    assert.equal(l.pastoId, livre.id);
    await assert.rejects(() => lote({ nome: "B", pastoId: descanso.id }), /reservado/);
    await assert.rejects(() => lote({ nome: "C", pastoId: "nao-existe" }), /não existe mais/);
  });

  it("editar mantém o próprio nome e permite continuar em pasto que ficou reservado", async () => {
    const p = await pasto("P");
    const l = await lote({ pastoId: p.id });
    await db.pastos.update(p.id, { situacao: "Reservado" });

    await atualizarLoteGado(l.id, { ...base, pastoId: p.id, raca: "Nelore" });
    assert.equal((await db.lotesGado.get(l.id))?.raca, "Nelore");

    const outro = await pasto("Outro");
    await alterarSituacao(outro.id, "Reservado");
    await assert.rejects(() => atualizarLoteGado(l.id, { ...base, pastoId: outro.id }), /reservado/);
  });

  it("mover lote respeita a reserva, aceita 'sem pasto' e ignora o mesmo pasto", async () => {
    const a = await pasto("A");
    const b = await pasto("B");
    const l = await lote({ pastoId: a.id });

    await moverLoteGado(l.id, b.id);
    assert.equal((await db.lotesGado.get(l.id))?.pastoId, b.id);

    await db.lotesGado.update(l.id, { syncStatus: "synced" });
    await moverLoteGado(l.id, b.id);
    assert.equal((await db.lotesGado.get(l.id))?.syncStatus, "synced"); // nada mudou

    await moverLoteGado(l.id, null);
    assert.equal((await db.lotesGado.get(l.id))?.pastoId, null);
    await assert.rejects(() => moverLoteGado("x", a.id), /não encontrado/);
  });

  it("excluir o lote apaga as cabeças dele e libera o nome", async () => {
    const l = await lote();
    const c = await criarCabeca(l.id, cabecaBase);
    await excluirLoteGado(l.id);
    assert.ok((await db.lotesGado.get(l.id))?.deletedAt);
    assert.ok((await db.cabecas.get(c.id))?.deletedAt);
    await lote(); // mesmo nome de novo
  });
});

describe("vacinas do lote", () => {
  it("guarda vacina aplicada em parte, com as cabeças que faltam", async () => {
    const l = await lote({
      vacinas: [
        { nome: " Aftosa ", aplicada: true, faltam: 3, data: addDias(hoje(), -10)! },
        { nome: "Raiva", aplicada: true, faltam: 0, data: "" },
        { nome: "Brucelose", aplicada: false, faltam: 5, data: addDias(hoje(), -1)! },
        { nome: "   ", aplicada: true, faltam: null, data: "" },
      ],
    });
    assert.equal(l.vacinas.length, 3);
    assert.deepEqual(l.vacinas[0], { nome: "Aftosa", aplicada: true, faltam: 3, data: addDias(hoje(), -10) });
    assert.equal(l.vacinas[1].faltam, null); // 0 = todas vacinadas
    assert.deepEqual(l.vacinas[2], { nome: "Brucelose", aplicada: false, faltam: null, data: "" });
  });

  it("rejeita data no futuro e mais cabeças faltando do que o lote tem", async () => {
    await assert.rejects(
      () => lote({ vacinas: [{ nome: "Aftosa", aplicada: true, faltam: null, data: addDias(hoje(), 2)! }] }),
      /futuro/
    );
    await assert.rejects(
      () => lote({ vacinas: [{ nome: "Aftosa", aplicada: true, faltam: 13, data: "" }] }),
      /0 a 12/
    );
    await assert.rejects(
      () => lote({ vacinas: [{ nome: "Aftosa", aplicada: true, faltam: 1.5, data: "" }] }),
      /0 a 12/
    );
  });
});

describe("cabeças cadastradas uma a uma", () => {
  it("cadastra por brinco, cor ou nome e normaliza o brinco", async () => {
    const l = await lote();
    const a = await criarCabeca(l.id, { ...cabecaBase, brinco: " br  001 " });
    assert.equal(a.brinco, "BR 001");
    assert.equal(a.loteGadoId, l.id);
    assert.equal(a.syncStatus, "pending");

    const b = await criarCabeca(l.id, { ...cabecaBase, brinco: "", cor: "Branca" });
    assert.equal(b.cor, "Branca");
    await criarCabeca(l.id, { ...cabecaBase, brinco: "", nome: "Mimosa" });
  });

  it("exige uma forma de reconhecer a cabeça e rejeita brinco repetido", async () => {
    const l = await lote();
    await assert.rejects(() => criarCabeca(l.id, { ...cabecaBase, brinco: "" }), /brinco, a cor ou o nome/);
    await criarCabeca(l.id, cabecaBase);
    await assert.rejects(() => criarCabeca(l.id, { ...cabecaBase, brinco: "br-001" }), /Já existe/);
  });

  it("rejeita nascimento no futuro e peso inválido", async () => {
    const l = await lote();
    await assert.rejects(
      () => criarCabeca(l.id, { ...cabecaBase, dataNascimento: addDias(hoje(), 1)! }),
      /futuro/
    );
    await assert.rejects(() => criarCabeca(l.id, { ...cabecaBase, pesoKg: 0 }), /Peso inválido/);
  });

  it("não deixa cadastrar mais cabeças do que o total do lote", async () => {
    const l = await lote({ composicao: [{ sexo: "Macho", categoria: "Touro", quantidade: 2 }] });
    await criarCabeca(l.id, { ...cabecaBase, brinco: "T-1", sexo: "Macho" });
    await criarCabeca(l.id, { ...cabecaBase, brinco: "T-2", sexo: "Macho" });
    await assert.rejects(() => criarCabeca(l.id, { ...cabecaBase, brinco: "T-3" }), /todas já estão cadastradas/);
  });

  it("não deixa o total do lote ficar menor que as cabeças já cadastradas", async () => {
    const l = await lote();
    await criarCabeca(l.id, { ...cabecaBase, brinco: "A" });
    await criarCabeca(l.id, { ...cabecaBase, brinco: "B" });
    await assert.rejects(
      () =>
        atualizarLoteGado(l.id, {
          ...base,
          composicao: [{ sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 1 }],
        }),
      /2 cabeças cadastradas/
    );
    await atualizarLoteGado(l.id, {
      ...base,
      composicao: [{ sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 2 }],
    });
  });

  it("edita e exclui; a exclusão libera vaga e brinco", async () => {
    const l = await lote({ composicao: [{ sexo: "Fêmea", categoria: "Novilha", quantidade: 1 }] });
    const c = await criarCabeca(l.id, cabecaBase);
    await atualizarCabeca(c.id, { ...cabecaBase, nome: "Margarida", pesoKg: 480 });
    assert.equal((await db.cabecas.get(c.id))?.nome, "Margarida");
    assert.equal((await db.cabecas.get(c.id))?.pesoKg, 480);

    await assert.rejects(() => criarCabeca(l.id, { ...cabecaBase, brinco: "OUTRO" }), /todas já estão/);
    await excluirCabeca(c.id);
    assert.ok((await db.cabecas.get(c.id))?.deletedAt);
    await criarCabeca(l.id, cabecaBase); // mesmo brinco e vaga livres de novo
    await assert.rejects(() => atualizarCabeca("x", cabecaBase), /não encontrada/);
  });
});
