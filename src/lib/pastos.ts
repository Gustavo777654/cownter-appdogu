import { db } from "./db";
import { ROTINAS, type TipoRotina } from "./rotinas";
import type { Pasto, PastoInput, Nota, SituacaoPasto, Tarefa, NivelPasto } from "./types";
import { hoje, uuid } from "./utils";

const agora = () => new Date().toISOString();
const chaveNome = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// ---------------------------------------------------------------------------
// Pastos
// ---------------------------------------------------------------------------

async function garantirNomeLivre(nome: string, ignorarId?: string) {
  const chave = chaveNome(nome);
  const existente = await db.pastos
    .filter((l) => !l.deletedAt && l.id !== ignorarId && chaveNome(l.nome) === chave)
    .first();
  if (existente) throw new Error(`Já existe um pasto chamado ${existente.nome}.`);
}

function limparPasto(input: PastoInput): PastoInput {
  const nome = input.nome.trim().replace(/\s+/g, " ");
  if (!nome) throw new Error("Informe o nome do pasto.");
  const area = input.areaHa;
  if (area !== null && (!Number.isFinite(area) || area <= 0 || area > 100000)) {
    throw new Error("Área inválida. Use um valor em hectares, por exemplo 15,5.");
  }
  return { nome, areaHa: area, nivelPasto: input.nivelPasto };
}

async function pastoPorId(id: string): Promise<Pasto> {
  const pasto = await db.pastos.get(id);
  if (!pasto || pasto.deletedAt) throw new Error("Pasto não encontrado.");
  return pasto;
}

export async function criarPasto(input: PastoInput): Promise<Pasto> {
  const dados = limparPasto(input);
  await garantirNomeLivre(dados.nome);

  const h = hoje();
  const t = agora();
  const pasto: Pasto = {
    ...dados,
    id: uuid(),
    nivelEm: h,
    situacao: "Em uso",
    situacaoDesde: h,
    remedioUltimaData: "",
    remedioIntervaloMeses: null,
    salUltimaData: "",
    salIntervaloDias: null,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    syncStatus: "pending",
  };
  await db.pastos.add(pasto);
  return pasto;
}

export async function atualizarPasto(id: string, input: PastoInput): Promise<void> {
  const atual = await pastoPorId(id);
  const dados = limparPasto(input);
  await garantirNomeLivre(dados.nome, id);

  await db.pastos.update(id, {
    ...dados,
    nivelEm: dados.nivelPasto !== atual.nivelPasto ? hoje() : atual.nivelEm,
    updatedAt: agora(),
    syncStatus: "pending",
  });
}

export async function atualizarNivel(id: string, nivel: NivelPasto): Promise<void> {
  const atual = await pastoPorId(id);
  if (atual.nivelPasto === nivel) return;
  await db.pastos.update(id, {
    nivelPasto: nivel,
    nivelEm: hoje(),
    updatedAt: agora(),
    syncStatus: "pending",
  });
}

/**
 * Reservar o pasto = deixá-lo descansando. Só dá para reservar um pasto vazio:
 * antes, os lotes de gado precisam ser movidos para outro pasto.
 * Liberar o pasto volta a situação para "Em uso".
 */
export async function alterarSituacao(id: string, situacao: SituacaoPasto): Promise<void> {
  const atual = await pastoPorId(id);
  if (atual.situacao === situacao) return;

  if (situacao === "Reservado") {
    const dentro = await db.lotesGado
      .where("pastoId")
      .equals(id)
      .filter((l) => !l.deletedAt)
      .count();
    if (dentro > 0) {
      throw new Error(
        `Há ${dentro} ${dentro === 1 ? "lote" : "lotes"} de gado neste pasto. Mova-${dentro === 1 ? "o" : "os"} para outro pasto antes de reservar.`
      );
    }
  }

  await db.pastos.update(id, {
    situacao,
    situacaoDesde: hoje(),
    updatedAt: agora(),
    syncStatus: "pending",
  });
}

/** Exclui o pasto: os lotes de gado ficam sem pasto e as tarefas e observações do pasto são removidas. */
export async function excluirPasto(id: string): Promise<void> {
  const t = agora();
  await db.transaction("rw", db.pastos, db.lotesGado, db.tarefas, db.notas, async () => {
    await db.pastos.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
    await db.lotesGado
      .where("pastoId")
      .equals(id)
      .filter((a) => !a.deletedAt)
      .modify({ pastoId: null, updatedAt: t, syncStatus: "pending" });
    await db.tarefas
      .where("pastoId")
      .equals(id)
      .filter((x) => !x.deletedAt)
      .modify({ deletedAt: t, updatedAt: t, syncStatus: "pending" });
    await db.notas
      .where("pastoId")
      .equals(id)
      .filter((x) => !x.deletedAt)
      .modify({ deletedAt: t, updatedAt: t, syncStatus: "pending" });
  });
}

// ---------------------------------------------------------------------------
// Rotinas (remédio e sal)
// ---------------------------------------------------------------------------

export interface RotinaInput {
  ultimaData: string; // YYYY-MM-DD ou ""
  intervalo: number | null; // meses (remédio) ou dias (sal)
}

export async function configurarRotina(
  pastoId: string,
  tipo: TipoRotina,
  input: RotinaInput
): Promise<void> {
  await pastoPorId(pastoId);
  const regra = ROTINAS[tipo];

  if (input.ultimaData && input.ultimaData > hoje()) {
    throw new Error("A última data não pode estar no futuro.");
  }
  if (input.intervalo !== null) {
    if (!Number.isInteger(input.intervalo) || input.intervalo < 1 || input.intervalo > regra.maximo) {
      throw new Error(`O intervalo deve ser um número inteiro de 1 a ${regra.maximo} ${regra.unidade}.`);
    }
    if (!input.ultimaData) {
      throw new Error("Informe a data da última vez para o app calcular a próxima.");
    }
  }

  const campos =
    tipo === "remedio"
      ? { remedioUltimaData: input.ultimaData, remedioIntervaloMeses: input.intervalo }
      : { salUltimaData: input.ultimaData, salIntervaloDias: input.intervalo };

  await db.pastos.update(pastoId, { ...campos, updatedAt: agora(), syncStatus: "pending" });
}

/** "Feito hoje": a última data passa a ser hoje e a contagem recomeça. */
export async function marcarRotinaFeita(pastoId: string, tipo: TipoRotina): Promise<void> {
  await pastoPorId(pastoId);
  const campos = tipo === "remedio" ? { remedioUltimaData: hoje() } : { salUltimaData: hoje() };
  await db.pastos.update(pastoId, { ...campos, updatedAt: agora(), syncStatus: "pending" });
}

// ---------------------------------------------------------------------------
// Tarefas e observações
// ---------------------------------------------------------------------------

export interface TarefaInput {
  titulo: string;
  observacao: string;
  prazo: string; // YYYY-MM-DD ou ""
}

export async function criarTarefa(pastoId: string, input: TarefaInput): Promise<Tarefa> {
  await pastoPorId(pastoId);
  const titulo = input.titulo.trim();
  if (!titulo) throw new Error("Descreva a tarefa.");
  if (input.prazo && !/^\d{4}-\d{2}-\d{2}$/.test(input.prazo)) throw new Error("Prazo inválido.");

  const t = agora();
  const tarefa: Tarefa = {
    id: uuid(),
    pastoId,
    titulo,
    observacao: input.observacao.trim(),
    prazo: input.prazo,
    feita: false,
    feitaEm: null,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    syncStatus: "pending",
  };
  await db.tarefas.add(tarefa);
  return tarefa;
}

export async function alternarTarefa(id: string): Promise<void> {
  const t = await db.tarefas.get(id);
  if (!t || t.deletedAt) return;
  const agoraIso = agora();
  await db.tarefas.update(id, {
    feita: !t.feita,
    feitaEm: t.feita ? null : agoraIso,
    updatedAt: agoraIso,
    syncStatus: "pending",
  });
}

/**
 * Apaga (exclusão lógica) as tarefas já feitas há mais de `dias` dias.
 * Retorna quantas foram apagadas. `dias` nulo ou inválido não apaga nada.
 */
export async function apagarTarefasFeitasAntigas(dias: number | null, agoraMs: number = Date.now()): Promise<number> {
  if (dias === null || !Number.isInteger(dias) || dias < 1) return 0;
  const limite = new Date(agoraMs - dias * 86_400_000).toISOString();
  const t = new Date(agoraMs).toISOString();
  return db.tarefas
    .filter((x) => !x.deletedAt && x.feita && x.feitaEm !== null && x.feitaEm < limite)
    .modify({ deletedAt: t, updatedAt: t, syncStatus: "pending" });
}

export async function excluirTarefa(id: string): Promise<void> {
  const t = agora();
  await db.tarefas.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
}

export async function criarNota(pastoId: string, texto: string): Promise<Nota> {
  await pastoPorId(pastoId);
  const limpo = texto.trim();
  if (!limpo) throw new Error("Escreva a observação.");

  const t = agora();
  const nota: Nota = {
    id: uuid(),
    pastoId,
    texto: limpo,
    data: hoje(),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    syncStatus: "pending",
  };
  await db.notas.add(nota);
  return nota;
}

export async function excluirNota(id: string): Promise<void> {
  const t = agora();
  await db.notas.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
}
