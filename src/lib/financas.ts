import { totalCabecas } from "./composicao";
import { db } from "./db";
import { criarLoteGado, garantirNomeLivre, loteGadoPorId } from "./gado";
import { arredondar } from "./recursos";
import { maximosMoviveis } from "./transferencia";
import {
  CATEGORIAS_DESPESA,
  type LinhaComposicao,
  type LoteGado,
  type Movimentacao,
  type Sexo,
} from "./types";
import { hoje, uuid } from "./utils";

const agora = () => new Date().toISOString();
const reais = (n: number) => Math.round(n * 100) / 100;

export interface ItemGado {
  sexo: Sexo;
  categoria: string;
  quantidade: number;
}

/** Como o valor foi informado: total, por cabeça ou por arroba (preço da @ x total de @). */
export type ValorInput =
  | { modo: "total"; total: number }
  | { modo: "cabeca"; porCabeca: number }
  | { modo: "arroba"; precoArroba: number; arrobas: number };

function calcularValor(v: ValorInput, cabecas: number): { valor: number; precoArroba: number | null; arrobas: number | null } {
  const ok = (n: number) => Number.isFinite(n) && n > 0 && n <= 1_000_000_000;
  if (v.modo === "total") {
    if (!ok(v.total)) throw new Error("Informe o valor total (maior que zero).");
    return { valor: reais(v.total), precoArroba: null, arrobas: null };
  }
  if (v.modo === "cabeca") {
    if (!ok(v.porCabeca)) throw new Error("Informe o valor por cabeça (maior que zero).");
    return { valor: reais(v.porCabeca * cabecas), precoArroba: null, arrobas: null };
  }
  if (!ok(v.precoArroba) || !ok(v.arrobas)) throw new Error("Informe o preço da arroba e o total de arrobas (maiores que zero).");
  return { valor: reais(v.precoArroba * v.arrobas), precoArroba: reais(v.precoArroba), arrobas: arredondar(v.arrobas) };
}

function validarData(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Informe a data.");
  if (data > hoje()) throw new Error("A data não pode estar no futuro.");
}

function texto(s: string, max: number, nome: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length > max) throw new Error(`${nome} pode ter no máximo ${max} letras.`);
  return t;
}

function resumo(itens: ItemGado[]): string {
  return itens.map((i) => `${i.quantidade} ${i.categoria.toLowerCase()}`).join(" · ");
}

function somar(comp: LinhaComposicao[], item: ItemGado, delta: number): LinhaComposicao[] {
  const copia = comp.map((l) => ({ ...l }));
  const linha = copia.find((l) => l.sexo === item.sexo && l.categoria === item.categoria);
  if (linha) linha.quantidade += delta;
  else if (delta > 0) copia.push({ sexo: item.sexo, categoria: item.categoria, quantidade: delta });
  return copia.filter((l) => l.quantidade > 0);
}

function limparItens(itens: ItemGado[]): ItemGado[] {
  const mapa = new Map<string, ItemGado>();
  for (const i of itens) {
    if (!Number.isInteger(i.quantidade) || i.quantidade < 0) throw new Error("A quantidade de cabeças deve ser um número inteiro.");
    if (i.quantidade === 0) continue;
    const chave = `${i.sexo}|${i.categoria}`;
    const e = mapa.get(chave);
    if (e) e.quantidade += i.quantidade;
    else mapa.set(chave, { ...i });
  }
  const lista = Array.from(mapa.values());
  if (lista.length === 0) throw new Error("Informe quantas cabeças.");
  return lista;
}

function nova(dados: Omit<Movimentacao, "id" | "createdAt" | "updatedAt" | "deletedAt" | "syncStatus">): Movimentacao {
  const t = agora();
  return { ...dados, id: uuid(), createdAt: t, updatedAt: t, deletedAt: null, syncStatus: "pending" };
}

// ---------------------------------------------------------------------------
// Venda: as cabeças saem do lote (ou o lote inteiro é encerrado)
// ---------------------------------------------------------------------------

export interface VendaInput {
  loteId: string;
  itens: ItemGado[];
  /** Cabeças cadastradas uma a uma que foram vendidas (saem do rebanho). */
  cabecaIds: string[];
  data: string;
  valor: ValorInput;
  comprador: string;
  observacoes: string;
}

export async function registrarVenda(input: VendaInput): Promise<Movimentacao> {
  validarData(input.data);
  const itens = limparItens(input.itens);
  const vendidas = itens.reduce((s, i) => s + i.quantidade, 0);
  const { valor, precoArroba, arrobas } = calcularValor(input.valor, vendidas);
  const comprador = texto(input.comprador, 80, "O nome do comprador");
  const obs = texto(input.observacoes, 300, "A observação");

  return db.transaction("rw", db.lotesGado, db.cabecas, db.partos, db.movimentacoes, async () => {
    const lote = await loteGadoPorId(input.loteId);
    const abertos = await db.partos.where("loteGadoId").equals(lote.id).filter((p) => !p.deletedAt && !p.desmamado).toArray();
    const maximos = maximosMoviveis(lote.composicao, abertos);

    let resto = lote.composicao;
    for (const i of itens) {
      const idx = lote.composicao.findIndex((l) => l.sexo === i.sexo && l.categoria === i.categoria);
      const disponivel = idx >= 0 ? maximos[idx] : 0;
      if (i.quantidade > disponivel) {
        const preso = idx >= 0 && disponivel < lote.composicao[idx].quantidade;
        throw new Error(
          preso
            ? `${i.categoria}: só dá para vender ${disponivel}. O resto está com o bezerro mamando; faça a desmama antes.`
            : `O lote não tem ${i.quantidade} ${i.categoria.toLowerCase()}.`
        );
      }
      resto = somar(resto, i, -i.quantidade);
    }

    const cabecas = [];
    for (const id of Array.from(new Set(input.cabecaIds))) {
      const c = await db.cabecas.get(id);
      if (!c || c.deletedAt || c.loteGadoId !== lote.id) throw new Error("Uma das cabeças escolhidas não está mais cadastrada neste lote.");
      cabecas.push(c);
    }
    for (const sexo of ["Fêmea", "Macho"] as Sexo[]) {
      const saindo = itens.filter((i) => i.sexo === sexo).reduce((s, i) => s + i.quantidade, 0);
      if (cabecas.filter((c) => c.sexo === sexo).length > saindo) {
        throw new Error("Você marcou mais cabeças cadastradas do que a quantidade vendida desse sexo.");
      }
    }

    const t = agora();
    const inteiro = totalCabecas(resto) === 0;
    if (inteiro) {
      // Vendeu tudo: o lote é encerrado junto com as cabeças cadastradas e os partos dele.
      await db.lotesGado.update(lote.id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
      await db.cabecas.where("loteGadoId").equals(lote.id).filter((c) => !c.deletedAt).modify({ deletedAt: t, updatedAt: t, syncStatus: "pending" });
      await db.partos.where("loteGadoId").equals(lote.id).filter((p) => !p.deletedAt).modify({ deletedAt: t, updatedAt: t, syncStatus: "pending" });
    } else {
      const restantes = (await db.cabecas.where("loteGadoId").equals(lote.id).filter((c) => !c.deletedAt).count()) - cabecas.length;
      if (restantes > totalCabecas(resto)) {
        throw new Error("As cabeças cadastradas que ficam passariam do total do lote. Marque também as cadastradas que foram vendidas.");
      }
      await db.lotesGado.update(lote.id, { composicao: resto, updatedAt: t, syncStatus: "pending" });
      for (const c of cabecas) await db.cabecas.update(c.id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
    }

    const mov = nova({
      tipo: "Venda",
      data: input.data,
      valor,
      descricao: resumo(itens),
      categoria: "",
      pastoId: lote.pastoId,
      loteGadoId: lote.id,
      loteNome: lote.nome,
      cabecas: vendidas,
      precoArroba,
      arrobas,
      contraparte: comprador,
      observacoes: obs,
    });
    await db.movimentacoes.add(mov);
    return mov;
  });
}

// ---------------------------------------------------------------------------
// Compra: cria um lote novo ou soma as cabeças a um lote existente
// ---------------------------------------------------------------------------

export type DestinoCompra =
  | { tipo: "novo"; nome: string; pastoId: string | null; raca: string }
  | { tipo: "lote"; loteId: string };

export interface CompraInput {
  destino: DestinoCompra;
  itens: ItemGado[];
  data: string;
  valor: ValorInput;
  vendedor: string;
  observacoes: string;
}

export async function registrarCompra(input: CompraInput): Promise<{ movimentacao: Movimentacao; lote: LoteGado }> {
  validarData(input.data);
  const itens = limparItens(input.itens);
  const comprados = itens.reduce((s, i) => s + i.quantidade, 0);
  const { valor, precoArroba, arrobas } = calcularValor(input.valor, comprados);
  const vendedor = texto(input.vendedor, 80, "O nome do vendedor");
  const obs = texto(input.observacoes, 300, "A observação");

  // Lote novo: o próprio cadastro de lotes valida nome repetido e pasto reservado.
  if (input.destino.tipo === "novo") {
    const d = input.destino;
    await garantirNomeLivre(d.nome.trim());
    return db.transaction("rw", db.lotesGado, db.pastos, db.movimentacoes, async () => {
      const lote = await criarLoteGado({
        nome: d.nome,
        pastoId: d.pastoId,
        composicao: itens,
        raca: d.raca,
        pesoMedioKg: null,
        origem: vendedor ? `Comprado de ${vendedor}` : "Comprado",
        situacao: "Normal",
        vacinas: [],
        observacoes: "",
      });
      const mov = nova({
        tipo: "Compra", data: input.data, valor, descricao: resumo(itens), categoria: "",
        pastoId: lote.pastoId, loteGadoId: lote.id, loteNome: lote.nome, cabecas: comprados,
        precoArroba, arrobas, contraparte: vendedor, observacoes: obs,
      });
      await db.movimentacoes.add(mov);
      return { movimentacao: mov, lote };
    });
  }

  const loteId = input.destino.loteId;
  return db.transaction("rw", db.lotesGado, db.movimentacoes, async () => {
    const lote = await loteGadoPorId(loteId);
    let comp = lote.composicao;
    for (const i of itens) comp = somar(comp, i, i.quantidade);
    await db.lotesGado.update(lote.id, { composicao: comp, updatedAt: agora(), syncStatus: "pending" });
    const mov = nova({
      tipo: "Compra", data: input.data, valor, descricao: resumo(itens), categoria: "",
      pastoId: lote.pastoId, loteGadoId: lote.id, loteNome: lote.nome, cabecas: comprados,
      precoArroba, arrobas, contraparte: vendedor, observacoes: obs,
    });
    await db.movimentacoes.add(mov);
    return { movimentacao: mov, lote: { ...lote, composicao: comp } };
  });
}

// ---------------------------------------------------------------------------
// Despesas lançadas à mão
// ---------------------------------------------------------------------------

export interface DespesaInput {
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  pastoId: string | null;
}

export async function registrarDespesa(input: DespesaInput): Promise<Movimentacao> {
  validarData(input.data);
  const descricao = texto(input.descricao, 100, "A descrição");
  if (!descricao) throw new Error("Descreva a despesa.");
  if (!(CATEGORIAS_DESPESA as readonly string[]).includes(input.categoria)) throw new Error("Escolha a categoria.");
  if (!Number.isFinite(input.valor) || input.valor <= 0 || input.valor > 1_000_000_000) throw new Error("Informe o valor (maior que zero).");
  if (input.pastoId) {
    const p = await db.pastos.get(input.pastoId);
    if (!p || p.deletedAt) throw new Error("O pasto escolhido não existe mais.");
  }
  const mov = nova({
    tipo: "Despesa", data: input.data, valor: reais(input.valor), descricao, categoria: input.categoria,
    pastoId: input.pastoId, loteGadoId: null, loteNome: "", cabecas: 0, precoArroba: null, arrobas: null,
    contraparte: "", observacoes: "",
  });
  await db.movimentacoes.add(mov);
  return mov;
}

/** Apaga só o lançamento financeiro; as cabeças do lote não voltam (ajuste o lote se precisar). */
export async function excluirMovimentacao(id: string): Promise<void> {
  const t = agora();
  await db.movimentacoes.update(id, { deletedAt: t, updatedAt: t, syncStatus: "pending" });
}
