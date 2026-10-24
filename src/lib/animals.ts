import { db } from "./db";
import type { Animal, AnimalInput } from "./types";
import { hoje, uuid } from "./utils";

export function normalizeBrinco(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toUpperCase();
}

async function garantirBrincoLivre(brinco: string, ignorarId?: string) {
  const existente = await db.animals
    .where("brinco")
    .equals(brinco)
    .filter((a) => !a.deletedAt && a.id !== ignorarId)
    .first();
  if (existente) {
    throw new Error(`Já existe um animal com o brinco ${brinco}.`);
  }
}

/** O pasto precisa existir e, se o animal está chegando nele, não pode estar reservado. */
async function validarLote(loteId: string | null, loteAtual: string | null) {
  if (!loteId) return;
  const lote = await db.lotes.get(loteId);
  if (!lote || lote.deletedAt) throw new Error("O pasto escolhido não existe mais.");
  if (lote.situacao === "Reservado" && loteId !== loteAtual) {
    throw new Error(
      `O pasto ${lote.nome} está reservado (descansando). Libere-o para uso antes de colocar animais.`
    );
  }
}

function limpar(input: AnimalInput): AnimalInput {
  const vacinas = input.vacinas
    .map((v) => ({ nome: v.nome.trim(), data: v.data }))
    .filter((v) => v.nome);
  if (vacinas.some((v) => v.data && v.data > hoje())) {
    throw new Error("A data de uma vacina não pode estar no futuro.");
  }
  return {
    ...input,
    brinco: normalizeBrinco(input.brinco),
    nome: input.nome.trim(),
    raca: input.raca.trim(),
    mae: input.mae.trim(),
    pai: input.pai.trim(),
    observacoes: input.observacoes.trim(),
    vacinas,
  };
}

export async function criarAnimal(input: AnimalInput): Promise<Animal> {
  const dados = limpar(input);
  if (!dados.brinco) throw new Error("Informe o número do brinco.");
  await garantirBrincoLivre(dados.brinco);
  await validarLote(dados.loteId, null);

  const agora = new Date().toISOString();
  const animal: Animal = {
    ...dados,
    id: uuid(),
    createdAt: agora,
    updatedAt: agora,
    deletedAt: null,
    syncStatus: "pending",
  };
  await db.animals.add(animal);
  return animal;
}

export async function atualizarAnimal(id: string, input: AnimalInput): Promise<void> {
  const atual = await db.animals.get(id);
  if (!atual || atual.deletedAt) throw new Error("Animal não encontrado.");

  const dados = limpar(input);
  if (!dados.brinco) throw new Error("Informe o número do brinco.");
  await garantirBrincoLivre(dados.brinco, id);
  await validarLote(dados.loteId, atual.loteId);

  await db.animals.update(id, {
    ...dados,
    updatedAt: new Date().toISOString(),
    syncStatus: "pending",
  });
}

/** Exclusão lógica: o registro some da tela, mas continua no banco até sincronizar. */
export async function excluirAnimal(id: string): Promise<void> {
  const agora = new Date().toISOString();
  await db.animals.update(id, {
    deletedAt: agora,
    updatedAt: agora,
    syncStatus: "pending",
  });
}
