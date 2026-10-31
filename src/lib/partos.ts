import { totalCabecas } from "./composicao";
import { db } from "./db";
import { contarCabecas, criarCabeca, garantirNomeLivre, loteGadoPorId } from "./gado";
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

/** Dados da mãe. Se a vaca for informada, ela fica cadastrada como cabeça do lote. */
export interface VacaInput {
  /** Cabeça já cadastrada neste lote (quando escolhida na lista). */
  cabecaId?: string | null;
  brinco?: string;
  nome?: string;
  cor?: string;
  raca?: string;
}

export interface PartoInput {
  data: string; // YYYY-MM-DD
  sexoBezerro: Sexo;
  vaca: VacaInput;
}

/**
 * Registra um parto: o bezerro entra no lote da mãe e uma vaca mojando (a que está quase
 * parindo) passa a ser "parida". Vaca atrasada ainda não vai parir, então não serve. Se o lote
 * já tem vaca parida sem parto registrado (cadastrada assim, ou seja, já pariu), só entra o bezerro.
 */
export async function registrarParto(loteGadoId: string, input: PartoInput): Promise<Parto> {
  if (!input.data) throw new Error("Informe a data do nascimento.");
  if (input.data > hoje()) throw new Error("A data do nascimento não pode estar no futuro.");
  if (input.sexoBezerro !== "Fêmea" && input.sexoBezerro !== "Macho") {
    throw new Error("Escolha se o bezerro é macho ou fêmea.");
  }
  const v = input.vaca;
  const brinco = (v.brinco ?? "").trim();
  const nomeVaca = (v.nome ?? "").trim();
  const cor = (v.cor ?? "").trim();
  const informouNova = !!(brinco || nomeVaca || cor);

  return db.transaction("rw", db.lotesGado, db.partos, db.cabecas, async () => {
    const lote = await loteGadoPorId(loteGadoId);
    let comp = lote.composicao;

    const abertos = await db.partos
      .where("loteGadoId")
      .equals(loteGadoId)
      .filter((p) => !p.deletedAt && !p.desmamado)
      .count();

    const mojando = quantidade(comp, "Fêmea", VACA_MOJANDO) > 0;
    if (mojando) {
      comp = ajustar(comp, "Fêmea", VACA_MOJANDO, -1);
      comp = ajustar(comp, "Fêmea", VACA_PARIDA, 1);
    } else if (quantidade(comp, "Fêmea", VACA_PARIDA) <= abertos) {
      throw new Error(
        "Este lote não tem vaca mojando (a que está quase parindo). Edite o lote e mude a vaca que vai parir para \"Vaca mojando\"."
      );
    }
    comp = ajustar(comp, input.sexoBezerro, bezerroDe(input.sexoBezerro), 1);

    const t = agora();
    await db.lotesGado.update(loteGadoId, { composicao: comp, updatedAt: t, syncStatus: "pending" });

    // A mãe fica cadastrada como cabeça do lote (ou usa a que já estava cadastrada).
    let vacaCabecaId: string | null = null;
    let vaca = "";
    if (v.cabecaId) {
      const c = await db.cabecas.get(v.cabecaId);
      if (!c || c.deletedAt || c.loteGadoId !== loteGadoId) {
        throw new Error("A vaca escolhida não está mais cadastrada neste lote.");
      }
      vacaCabecaId = c.id;
      vaca = c.brinco || c.nome || c.cor;
    } else if (informouNova) {
      const c = await criarCabeca(loteGadoId, {
        brinco,
        cor,
        nome: nomeVaca,
        raca: (v.raca ?? "").trim() || lote.raca,
        sexo: "Fêmea",
        dataNascimento: "",
        pesoKg: null,
        mae: "",
        pai: "",
        observacoes: "",
      });
      vacaCabecaId = c.id;
      vaca = c.brinco || c.nome || c.cor;
    }

    const parto: Parto = {
      id: uuid(),
      loteGadoId,
      data: input.data,
      sexoBezerro: input.sexoBezerro,
      vaca,
      vacaCabecaId,
      converteuMojando: mojando,
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

/**
 * Exclui um registro de parto feito por engano e desfaz o efeito no lote: o bezerro sai da
 * composição e, se o parto tinha transformado uma vaca mojando em parida, ela volta a mojando.
 * (A vaca cadastrada como cabeça continua cadastrada.) Bezerro já desmamado não pode ser desfeito.
 */
export async function excluirParto(id: string): Promise<void> {
  await db.transaction("rw", db.lotesGado, db.partos, db.cabecas, async () => {
    const parto = await db.partos.get(id);
    if (!parto || parto.deletedAt) return;
    if (parto.desmamado) throw new Error("Este bezerro já foi desmamado; o registro não pode ser desfeito.");
    const lote = await loteGadoPorId(parto.loteGadoId);

    let comp = ajustar(lote.composicao, parto.sexoBezerro, bezerroDe(parto.sexoBezerro), -1);
    if (parto.converteuMojando && quantidade(comp, "Fêmea", VACA_PARIDA) > 0) {
      comp = ajustar(comp, "Fêmea", VACA_PARIDA, -1);
      comp = ajustar(comp, "Fêmea", VACA_MOJANDO, 1);
    }
    if (totalCabecas(comp) < (await contarCabecas(lote.id))) {
      throw new Error("Há cabeças cadastradas demais para remover este bezerro do lote. Exclua uma cabeça cadastrada antes.");
    }
    const t = agora();
    await db.lotesGado.update(lote.id, { composicao: comp, updatedAt: t, syncStatus: "pending" });
    await db.partos.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
  });
}

/** Vacas paridas do lote que ainda não têm parto registrado (já pariram, falta lançar o bezerro). */
export function paridasSemParto(
  composicao: LinhaComposicao[],
  partosAbertos: number
): number {
  return Math.max(0, quantidade(composicao, "Fêmea", VACA_PARIDA) - partosAbertos);
}
