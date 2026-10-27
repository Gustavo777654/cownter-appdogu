import { limparComposicao, totalCabecas } from "./composicao";
import { db } from "./db";
import {
  SITUACOES_LOTE_GADO,
  type Cabeca,
  type CabecaInput,
  type LoteGado,
  type LoteGadoInput,
  type VacinaLote,
} from "./types";
import { hoje, uuid } from "./utils";

const agora = () => new Date().toISOString();
const chaveNome = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// ---------------------------------------------------------------------------
// Lotes de gado
// ---------------------------------------------------------------------------

export function normalizeBrinco(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toUpperCase();
}

export async function garantirNomeLivre(nome: string, ignorarId?: string) {
  const chave = chaveNome(nome);
  const existente = await db.lotesGado
    .filter((l) => !l.deletedAt && l.id !== ignorarId && chaveNome(l.nome) === chave)
    .first();
  if (existente) throw new Error(`Já existe um lote chamado ${existente.nome}.`);
}

/** O pasto precisa existir e, se o lote está chegando nele, não pode estar reservado. */
async function validarPasto(pastoId: string | null, pastoAtual: string | null) {
  if (!pastoId) return;
  const pasto = await db.pastos.get(pastoId);
  if (!pasto || pasto.deletedAt) throw new Error("O pasto escolhido não existe mais.");
  if (pasto.situacao === "Reservado" && pastoId !== pastoAtual) {
    throw new Error(
      `O pasto ${pasto.nome} está reservado (descansando). Libere-o para uso antes de colocar lotes de gado.`
    );
  }
}

function limparVacinas(vacinas: VacinaLote[], total: number): VacinaLote[] {
  const limpas: VacinaLote[] = [];
  for (const v of vacinas) {
    const nome = v.nome.trim();
    if (!nome) continue;
    if (v.aplicada && v.data && v.data > hoje()) {
      throw new Error("A data de uma vacina não pode estar no futuro.");
    }
    let faltam: number | null = null;
    if (v.aplicada && v.faltam !== null && v.faltam !== 0) {
      if (!Number.isInteger(v.faltam) || v.faltam < 0 || v.faltam > total) {
        throw new Error(
          `Na vacina ${nome}, as cabeças que faltam devem ser de 0 a ${total}.`
        );
      }
      faltam = v.faltam;
    }
    limpas.push({ nome, aplicada: v.aplicada, faltam, data: v.aplicada ? v.data : "" });
  }
  return limpas;
}

function limparLoteGado(input: LoteGadoInput): LoteGadoInput {
  const nome = input.nome.trim().replace(/\s+/g, " ");
  if (!nome) throw new Error("Informe o nome do lote.");

  const composicao = limparComposicao(input.composicao);
  const total = totalCabecas(composicao);

  const peso = input.pesoMedioKg;
  if (peso !== null && (!Number.isFinite(peso) || peso <= 0 || peso > 2000)) {
    throw new Error("Peso inválido. Use um valor em kg, por exemplo 480 ou 320,5.");
  }
  const origem = input.origem.trim().replace(/\s+/g, " ");
  if (origem.length > 120) throw new Error("A origem pode ter no máximo 120 letras.");
  if (!SITUACOES_LOTE_GADO.includes(input.situacao)) throw new Error("Situação inválida.");

  return {
    nome,
    pastoId: input.pastoId,
    composicao,
    raca: input.raca.trim(),
    pesoMedioKg: peso,
    origem,
    situacao: input.situacao,
    vacinas: limparVacinas(input.vacinas, total),
    observacoes: input.observacoes.trim(),
  };
}

export async function loteGadoPorId(id: string): Promise<LoteGado> {
  const lote = await db.lotesGado.get(id);
  if (!lote || lote.deletedAt) throw new Error("Lote não encontrado.");
  return lote;
}

export async function criarLoteGado(input: LoteGadoInput): Promise<LoteGado> {
  const dados = limparLoteGado(input);
  await garantirNomeLivre(dados.nome);
  await validarPasto(dados.pastoId, null);

  const t = agora();
  const lote: LoteGado = {
    ...dados,
    id: uuid(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    syncStatus: "pending",
  };
  await db.lotesGado.add(lote);
  return lote;
}

export async function atualizarLoteGado(id: string, input: LoteGadoInput): Promise<void> {
  const atual = await loteGadoPorId(id);
  const dados = limparLoteGado(input);
  await garantirNomeLivre(dados.nome, id);
  await validarPasto(dados.pastoId, atual.pastoId);

  // O total não pode ficar menor do que as cabeças já cadastradas uma a uma.
  const individuais = await contarCabecas(id);
  const total = totalCabecas(dados.composicao);
  if (total < individuais) {
    throw new Error(
      `O lote tem ${individuais} ${individuais === 1 ? "cabeça cadastrada" : "cabeças cadastradas"} individualmente. O total não pode ser menor que isso.`
    );
  }

  await db.lotesGado.update(id, { ...dados, updatedAt: agora(), syncStatus: "pending" });
}

/** Exclusão lógica do lote e das cabeças cadastradas dentro dele. */
export async function excluirLoteGado(id: string): Promise<void> {
  const t = agora();
  await db.transaction("rw", db.lotesGado, db.cabecas, db.partos, async () => {
    await db.lotesGado.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
    await db.partos
      .where("loteGadoId")
      .equals(id)
      .filter((p) => !p.deletedAt)
      .modify({ deletedAt: t, updatedAt: t, syncStatus: "pending" });
    await db.cabecas
      .where("loteGadoId")
      .equals(id)
      .filter((c) => !c.deletedAt)
      .modify({ deletedAt: t, updatedAt: t, syncStatus: "pending" });
  });
}

/**
 * Move o lote para um pasto (ou para "sem pasto", com pastoId = null).
 * Um pasto reservado (descansando) só recebe o lote se o produtor confirmar
 * (liberarPastoReservado = true): nesse caso o pasto volta a ficar "Em uso".
 */
export async function moverLoteGado(
  id: string,
  pastoId: string | null,
  opcoes: { liberarPastoReservado?: boolean } = {}
): Promise<void> {
  await db.transaction("rw", db.lotesGado, db.pastos, async () => {
    const lote = await loteGadoPorId(id);
    if (lote.pastoId === pastoId) return;

    if (pastoId && opcoes.liberarPastoReservado) {
      const pasto = await db.pastos.get(pastoId);
      if (pasto && !pasto.deletedAt && pasto.situacao === "Reservado") {
        await db.pastos.update(pastoId, {
          situacao: "Em uso",
          situacaoDesde: hoje(),
          updatedAt: agora(),
          syncStatus: "pending",
        });
      }
    }

    await validarPasto(pastoId, lote.pastoId);
    await db.lotesGado.update(id, { pastoId, updatedAt: agora(), syncStatus: "pending" });
  });
}

// ---------------------------------------------------------------------------
// Cabeças cadastradas uma a uma (opcional)
// ---------------------------------------------------------------------------

export async function contarCabecas(loteGadoId: string): Promise<number> {
  return db.cabecas
    .where("loteGadoId")
    .equals(loteGadoId)
    .filter((c) => !c.deletedAt)
    .count();
}

function limparCabeca(input: CabecaInput): CabecaInput {
  const dados: CabecaInput = {
    ...input,
    brinco: normalizeBrinco(input.brinco),
    cor: input.cor.trim(),
    nome: input.nome.trim(),
    raca: input.raca.trim(),
    mae: input.mae.trim(),
    pai: input.pai.trim(),
    observacoes: input.observacoes.trim(),
  };
  if (!dados.brinco && !dados.cor && !dados.nome) {
    throw new Error("Informe o brinco, a cor ou o nome para reconhecer a cabeça.");
  }
  if (dados.dataNascimento && dados.dataNascimento > hoje()) {
    throw new Error("A data de nascimento não pode estar no futuro.");
  }
  const peso = dados.pesoKg;
  if (peso !== null && (!Number.isFinite(peso) || peso <= 0 || peso > 2000)) {
    throw new Error("Peso inválido. Use um valor em kg, por exemplo 480 ou 320,5.");
  }
  return dados;
}

async function garantirBrincoLivre(brinco: string, ignorarId?: string) {
  if (!brinco) return;
  const existente = await db.cabecas
    .where("brinco")
    .equals(brinco)
    .filter((c) => !c.deletedAt && c.id !== ignorarId)
    .first();
  if (existente) throw new Error(`Já existe uma cabeça com o brinco ${brinco}.`);
}

export async function criarCabeca(loteGadoId: string, input: CabecaInput): Promise<Cabeca> {
  const lote = await loteGadoPorId(loteGadoId);
  const dados = limparCabeca(input);
  await garantirBrincoLivre(dados.brinco);

  const individuais = await contarCabecas(loteGadoId);
  const total = totalCabecas(lote.composicao);
  if (individuais + 1 > total) {
    throw new Error(
      `O lote tem ${total} ${total === 1 ? "cabeça" : "cabeças"} e todas já estão cadastradas. Aumente o total do lote antes.`
    );
  }

  const t = agora();
  const cabeca: Cabeca = {
    ...dados,
    id: uuid(),
    loteGadoId,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    syncStatus: "pending",
  };
  await db.cabecas.add(cabeca);
  return cabeca;
}

export async function atualizarCabeca(id: string, input: CabecaInput): Promise<void> {
  const atual = await db.cabecas.get(id);
  if (!atual || atual.deletedAt) throw new Error("Cabeça não encontrada.");
  const dados = limparCabeca(input);
  await garantirBrincoLivre(dados.brinco, id);
  await db.cabecas.update(id, { ...dados, updatedAt: agora(), syncStatus: "pending" });
}

export async function excluirCabeca(id: string): Promise<void> {
  const t = agora();
  await db.cabecas.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
}
