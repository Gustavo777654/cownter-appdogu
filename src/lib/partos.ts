import { totalCabecas } from "./composicao";
import { db } from "./db";
import { contarCabecas, garantirNomeLivre, loteGadoPorId } from "./gado";
import type { LinhaComposicao, LoteGado, Parto, Sexo } from "./types";
import { hoje, uuid } from "./utils";

const agora = () => new Date().toISOString();

const VACA_MOJANDO = "Vaca mojando";
const VACA_ATRASADA = "Vaca atrasada";
const VACA_PARIDA = "Vaca parida";
const bezerroDe = (sexo: Sexo) => (sexo === "Fêmea" ? "Bezerra" : "Bezerro");

function ajustar(
  composicao: LinhaComposicao[],
  sexo: Sexo,
  categoria: string,
  delta: number
): LinhaComposicao[] {
  const copia = composicao.map((l) => ({ ...l }));
  const linha = copia.find((l) => l.sexo === sexo && l.categoria === categoria);
  if (linha) linha.quantidade += delta;
  else if (delta > 0) copia.push({ sexo, categoria, quantidade: delta });
  return copia.filter((l) => l.quantidade > 0);
}

const quantidade = (c: LinhaComposicao[], sexo: Sexo, categoria: string) =>
  c.find((l) => l.sexo === sexo && l.categoria === categoria)?.quantidade ?? 0;

export interface PartoInput {
  data: string; // YYYY-MM-DD
  sexoBezerro: Sexo;
  vaca: string;
}

/**
 * Registra um parto: o bezerro entra no lote da mãe e uma vaca (mojando; se não houver,
 * atrasada) passa a ser "parida". Se o lote já tem vaca parida sem parto registrado
 * (cadastrada assim na composição), só entra o bezerro.
 */
export async function registrarParto(loteGadoId: string, input: PartoInput): Promise<Parto> {
  if (!input.data) throw new Error("Informe a data do nascimento.");
  if (input.data > hoje()) throw new Error("A data do nascimento não pode estar no futuro.");
  if (input.sexoBezerro !== "Fêmea" && input.sexoBezerro !== "Macho") {
    throw new Error("Escolha se o bezerro é macho ou fêmea.");
  }
  const vaca = input.vaca.trim().replace(/\s+/g, " ");
  if (vaca.length > 60) throw new Error("A identificação da vaca pode ter no máximo 60 letras.");

  return db.transaction("rw", db.lotesGado, db.partos, async () => {
    const lote = await loteGadoPorId(loteGadoId);
    let comp = lote.composicao;

    const abertos = await db.partos
      .where("loteGadoId")
      .equals(loteGadoId)
      .filter((p) => !p.deletedAt && !p.desmamado)
      .count();

    const origem = [VACA_MOJANDO, VACA_ATRASADA].find((c) => quantidade(comp, "Fêmea", c) > 0);
    if (origem) {
      comp = ajustar(comp, "Fêmea", origem, -1);
      comp = ajustar(comp, "Fêmea", VACA_PARIDA, 1);
    } else if (quantidade(comp, "Fêmea", VACA_PARIDA) <= abertos) {
      throw new Error("Este lote não tem vaca mojando ou atrasada para registrar o parto.");
    }
    comp = ajustar(comp, input.sexoBezerro, bezerroDe(input.sexoBezerro), 1);

    const t = agora();
    await db.lotesGado.update(loteGadoId, { composicao: comp, updatedAt: t, syncStatus: "pending" });
    const parto: Parto = {
      id: uuid(),
      loteGadoId,
      data: input.data,
      sexoBezerro: input.sexoBezerro,
      vaca,
      desmamado: false,
      desmamadoEm: null,
      destinoLoteId: null,
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
      syncStatus: "pending",
    };
    await db.partos.add(parto);
    return parto;
  });
}

export type DestinoDesmama = { tipo: "lote"; loteId: string } | { tipo: "novo"; nome: string };

/**
 * Desmama os bezerros escolhidos: eles saem do lote da mãe para um lote existente ou para um
 * lote novo (no mesmo pasto), e as mães voltam a ser "vaca atrasada".
 */
export async function desmamar(
  loteGadoId: string,
  partoIds: string[],
  destino: DestinoDesmama
): Promise<{ destino: LoteGado }> {
  if (partoIds.length === 0) throw new Error("Escolha pelo menos um bezerro para desmamar.");
  const ids = Array.from(new Set(partoIds));

  return db.transaction("rw", db.lotesGado, db.partos, db.cabecas, async () => {
    const origem = await loteGadoPorId(loteGadoId);
    const partos: Parto[] = [];
    for (const id of ids) {
      const p = await db.partos.get(id);
      if (!p || p.deletedAt || p.loteGadoId !== loteGadoId || p.desmamado) {
        throw new Error("Um dos bezerros escolhidos não está mais mamando neste lote.");
      }
      partos.push(p);
    }

    const femeas = partos.filter((p) => p.sexoBezerro === "Fêmea").length;
    const machos = partos.length - femeas;
    if (quantidade(origem.composicao, "Fêmea", "Bezerra") < femeas || quantidade(origem.composicao, "Macho", "Bezerro") < machos) {
      throw new Error("A composição do lote tem menos bezerros do que os partos registrados. Confira a composição do lote.");
    }

    let compOrigem = origem.composicao;
    if (femeas) compOrigem = ajustar(compOrigem, "Fêmea", "Bezerra", -femeas);
    if (machos) compOrigem = ajustar(compOrigem, "Macho", "Bezerro", -machos);
    const paridas = Math.min(partos.length, quantidade(compOrigem, "Fêmea", VACA_PARIDA));
    if (paridas > 0) {
      compOrigem = ajustar(compOrigem, "Fêmea", VACA_PARIDA, -paridas);
      compOrigem = ajustar(compOrigem, "Fêmea", VACA_ATRASADA, paridas);
    }

    const individuais = await contarCabecas(loteGadoId);
    if (totalCabecas(compOrigem) < individuais) {
      throw new Error(
        `O lote tem ${individuais} cabeças cadastradas individualmente, mais do que ficaria depois da desmama. Ajuste as cabeças cadastradas antes.`
      );
    }

    const novas: LinhaComposicao[] = [];
    if (femeas) novas.push({ sexo: "Fêmea", categoria: "Bezerra", quantidade: femeas });
    if (machos) novas.push({ sexo: "Macho", categoria: "Bezerro", quantidade: machos });

    const t = agora();
    let destinoLote: LoteGado;
    if (destino.tipo === "lote") {
      if (destino.loteId === loteGadoId) throw new Error("Escolha um lote diferente do lote da mãe.");
      const d = await loteGadoPorId(destino.loteId);
      let comp = d.composicao;
      for (const n of novas) comp = ajustar(comp, n.sexo, n.categoria, n.quantidade);
      await db.lotesGado.update(d.id, { composicao: comp, updatedAt: t, syncStatus: "pending" });
      destinoLote = { ...d, composicao: comp };
    } else {
      const nome = destino.nome.trim().replace(/\s+/g, " ");
      if (!nome) throw new Error("Informe o nome do novo lote.");
      await garantirNomeLivre(nome);
      destinoLote = {
        id: uuid(),
        nome,
        pastoId: origem.pastoId,
        composicao: novas,
        raca: origem.raca,
        pesoMedioKg: null,
        origem: "Nascido na fazenda",
        situacao: "Normal",
        vacinas: [],
        observacoes: "",
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
        syncStatus: "pending",
      };
      await db.lotesGado.add(destinoLote);
    }

    await db.lotesGado.update(loteGadoId, { composicao: compOrigem, updatedAt: t, syncStatus: "pending" });
    for (const p of partos) {
      await db.partos.update(p.id, {
        desmamado: true,
        desmamadoEm: hoje(),
        destinoLoteId: destinoLote.id,
        updatedAt: t,
        syncStatus: "pending",
      });
    }
    return { destino: destinoLote };
  });
}

/** Exclui um registro de parto feito por engano (não mexe na composição do lote). */
export async function excluirParto(id: string): Promise<void> {
  const t = agora();
  await db.partos.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
}
