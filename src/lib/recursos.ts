import { db } from "./db";
import type { TipoRotina } from "./rotinas";
import type { CompraRecurso, Recurso, TipoRecurso, UsoRecurso } from "./types";
import { TIPOS_RECURSO } from "./types";
import { hoje, uuid } from "./utils";

const agora = () => new Date().toISOString();
const chaveNome = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Arredonda para 3 casas (evita 0,1 + 0,2 = 0,30000000000000004). */
export const arredondar = (n: number) => Math.round(n * 1000) / 1000;

/** Que tipo de item cada rotina do pasto usa. */
export const RECURSO_DA_ROTINA: Record<TipoRotina, TipoRecurso> = { sal: "Suplemento", remedio: "Remédio" };

export const UNIDADE: Record<TipoRecurso, { singular: string; plural: string }> = {
  Suplemento: { singular: "saco", plural: "sacos" },
  Remédio: { singular: "frasco", plural: "frascos" },
};

export function formatarQuantidade(n: number): string {
  return arredondar(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function formatarUnidades(n: number, tipo: TipoRecurso): string {
  const u = UNIDADE[tipo];
  return `${formatarQuantidade(n)} ${arredondar(n) === 1 ? u.singular : u.plural}`;
}

export function formatarReais(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function numeroPositivo(valor: number | null, nome: string, opcional: boolean, maximo = 1_000_000): number | null {
  if (valor === null) {
    if (opcional) return null;
    throw new Error(`Informe ${nome}.`);
  }
  if (!Number.isFinite(valor) || valor < 0 || valor > maximo) throw new Error(`${nome[0].toUpperCase()}${nome.slice(1)} inválido.`);
  return arredondar(valor);
}

export interface RecursoInput {
  tipo: TipoRecurso;
  nome: string;
  kgPorSaco: number | null;
  precoUnitario: number | null;
  estoqueMinimo: number | null;
}

function limparRecurso(input: RecursoInput): RecursoInput {
  if (!TIPOS_RECURSO.includes(input.tipo)) throw new Error("Tipo inválido.");
  const nome = input.nome.trim().replace(/\s+/g, " ");
  if (!nome) throw new Error("Informe o nome.");
  if (nome.length > 80) throw new Error("O nome pode ter no máximo 80 letras.");
  let kg: number | null = null;
  if (input.tipo === "Suplemento") {
    kg = numeroPositivo(input.kgPorSaco, "os kg de cada saco", false, 1000);
    if (!kg) throw new Error("Os kg de cada saco devem ser maiores que zero.");
  }
  return {
    tipo: input.tipo,
    nome,
    kgPorSaco: kg,
    precoUnitario: numeroPositivo(input.precoUnitario, "o preço", true),
    estoqueMinimo: numeroPositivo(input.estoqueMinimo, "o estoque mínimo", true),
  };
}

async function garantirNomeLivre(tipo: TipoRecurso, nome: string, ignorarId?: string) {
  const chave = chaveNome(nome);
  const existente = await db.recursos
    .filter((r) => !r.deletedAt && r.tipo === tipo && r.id !== ignorarId && chaveNome(r.nome) === chave)
    .first();
  if (existente) throw new Error(`Já existe ${tipo === "Suplemento" ? "um suplemento" : "um remédio"} chamado ${existente.nome}.`);
}

export async function recursoPorId(id: string): Promise<Recurso> {
  const r = await db.recursos.get(id);
  if (!r || r.deletedAt) throw new Error("Item não encontrado.");
  return r;
}

function novaCompra(recursoId: string, data: string, quantidade: number, preco: number | null): CompraRecurso {
  const t = agora();
  return {
    id: uuid(),
    recursoId,
    data,
    quantidade,
    precoUnitario: preco,
    total: preco === null ? null : arredondar(quantidade * preco),
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    syncStatus: "pending",
  };
}

/** Cadastra o item no estoque. Se já tem quantidade, ela entra como a primeira compra. */
export async function criarRecurso(input: RecursoInput, estoqueInicial: number | null): Promise<Recurso> {
  const dados = limparRecurso(input);
  const qtd = numeroPositivo(estoqueInicial, "a quantidade", true) ?? 0;
  await garantirNomeLivre(dados.tipo, dados.nome);

  const t = agora();
  const recurso: Recurso = {
    ...dados,
    id: uuid(),
    estoque: qtd,
    createdAt: t,
    updatedAt: t,
    deletedAt: null,
    syncStatus: "pending",
  };
  await db.transaction("rw", db.recursos, db.comprasRecurso, async () => {
    await db.recursos.add(recurso);
    if (qtd > 0) await db.comprasRecurso.add(novaCompra(recurso.id, hoje(), qtd, dados.precoUnitario));
  });
  return recurso;
}

export async function atualizarRecurso(id: string, input: RecursoInput): Promise<void> {
  const atual = await recursoPorId(id);
  const dados = limparRecurso({ ...input, tipo: atual.tipo });
  await garantirNomeLivre(atual.tipo, dados.nome, id);
  await db.recursos.update(id, { ...dados, updatedAt: agora(), syncStatus: "pending" });
}

/** Corrige o estoque quando a contagem real é outra (não gera compra nem despesa). */
export async function corrigirEstoque(id: string, novoEstoque: number): Promise<void> {
  await recursoPorId(id);
  const n = numeroPositivo(novoEstoque, "o estoque", false);
  await db.recursos.update(id, { estoque: n!, updatedAt: agora(), syncStatus: "pending" });
}

/** Nova compra do mesmo item: soma ao estoque e guarda a data e o valor (vira despesa em Finanças). */
export async function reporEstoque(
  id: string,
  dados: { data: string; quantidade: number; precoUnitario: number | null }
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) throw new Error("Informe a data da compra.");
  if (dados.data > hoje()) throw new Error("A data da compra não pode estar no futuro.");
  const qtd = numeroPositivo(dados.quantidade, "a quantidade", false)!;
  if (qtd <= 0) throw new Error("A quantidade comprada deve ser maior que zero.");
  const preco = numeroPositivo(dados.precoUnitario, "o preço", true);

  await db.transaction("rw", db.recursos, db.comprasRecurso, async () => {
    const r = await recursoPorId(id);
    await db.comprasRecurso.add(novaCompra(id, dados.data, qtd, preco));
    await db.recursos.update(id, {
      estoque: arredondar(r.estoque + qtd),
      precoUnitario: preco ?? r.precoUnitario,
      updatedAt: agora(),
      syncStatus: "pending",
    });
  });
}

export async function excluirRecurso(id: string): Promise<void> {
  const t = agora();
  await db.recursos.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
}

export interface UsoInput {
  recursoId: string;
  quantidade: number; // sacos ou frascos, aceita decimal
}

/**
 * Marca o sal ou o remédio do pasto como feito hoje e baixa do estoque o que foi usado.
 * Tudo ou nada: se um item não tem estoque suficiente, nada é alterado.
 */
export async function registrarUsoRotina(pastoId: string, rotina: TipoRotina, usos: UsoInput[]): Promise<void> {
  if (usos.length === 0) throw new Error("Escolha pelo menos um item do estoque.");
  const ids = usos.map((u) => u.recursoId);
  if (new Set(ids).size !== ids.length) throw new Error("O mesmo item aparece duas vezes. Some as quantidades em uma linha só.");

  await db.transaction("rw", db.pastos, db.recursos, db.usosRecurso, async () => {
    const pasto = await db.pastos.get(pastoId);
    if (!pasto || pasto.deletedAt) throw new Error("Pasto não encontrado.");

    const t = agora();
    const data = hoje();
    for (const u of usos) {
      const qtd = arredondar(u.quantidade);
      if (!Number.isFinite(qtd) || qtd <= 0) throw new Error("Informe a quantidade usada de cada item (maior que zero).");
      const r = await recursoPorId(u.recursoId);
      if (r.tipo !== RECURSO_DA_ROTINA[rotina]) {
        throw new Error(`${r.nome} é ${r.tipo === "Suplemento" ? "um suplemento" : "um remédio"} e não serve para ${rotina === "sal" ? "o sal" : "o remédio"}.`);
      }
      if (qtd > r.estoque) {
        throw new Error(`${r.nome}: tem só ${formatarUnidades(r.estoque, r.tipo)} em estoque e você informou ${formatarQuantidade(qtd)}.`);
      }
      await db.recursos.update(r.id, { estoque: arredondar(r.estoque - qtd), updatedAt: t, syncStatus: "pending" });
      const uso: UsoRecurso = {
        id: uuid(),
        recursoId: r.id,
        pastoId,
        rotina,
        data,
        quantidade: qtd,
        custo: r.precoUnitario === null ? null : arredondar(qtd * r.precoUnitario),
        createdAt: t,
        updatedAt: t,
        deletedAt: null,
        syncStatus: "pending",
      };
      await db.usosRecurso.add(uso);
    }
    const campos = rotina === "remedio" ? { remedioUltimaData: data } : { salUltimaData: data };
    await db.pastos.update(pastoId, { ...campos, updatedAt: t, syncStatus: "pending" });
  });
}
