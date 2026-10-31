import { totalCabecas } from "./composicao";
import { db } from "./db";
import { contarCabecas, garantirNomeLivre, loteGadoPorId } from "./gado";
import type { LinhaComposicao, LoteGado, Parto, Sexo } from "./types";
import { uuid } from "./utils";

const agora = () => new Date().toISOString();

export interface ItemMover {
  sexo: Sexo;
  categoria: string;
  quantidade: number;
}

/**
 * Quantas cabeças de cada linha podem sair do lote. Bezerro mamando e vaca parida com bezerro
 * ficam junto da mãe: só saem pela desmama.
 */
export function maximosMoviveis(
  composicao: LinhaComposicao[],
  partosAbertos: Pick<Parto, "sexoBezerro">[]
): number[] {
  const mamando = (sexo: Sexo) => partosAbertos.filter((p) => p.sexoBezerro === sexo).length;
  return composicao.map((l) => {
    if (l.sexo === "Fêmea" && l.categoria === "Bezerra") return Math.max(0, l.quantidade - mamando("Fêmea"));
    if (l.sexo === "Macho" && l.categoria === "Bezerro") return Math.max(0, l.quantidade - mamando("Macho"));
    if (l.sexo === "Fêmea" && l.categoria === "Vaca parida") return Math.max(0, l.quantidade - partosAbertos.length);
    return l.quantidade;
  });
}

function somar(comp: LinhaComposicao[], item: ItemMover, delta: number): LinhaComposicao[] {
  const copia = comp.map((l) => ({ ...l }));
  const linha = copia.find((l) => l.sexo === item.sexo && l.categoria === item.categoria);
  if (linha) linha.quantidade += delta;
  else if (delta > 0) copia.push({ sexo: item.sexo, categoria: item.categoria, quantidade: delta });
  return copia.filter((l) => l.quantidade > 0);
}

export type DestinoMover = { tipo: "lote"; loteId: string } | { tipo: "novo"; nome: string };

/**
 * Move algumas cabeças de um lote para outro (existente ou novo, no mesmo pasto do lote de origem).
 * As cabeças cadastradas marcadas vão junto; elas contam entre as que saem do sexo correspondente.
 */
export async function moverCabecas(
  origemId: string,
  itens: ItemMover[],
  cabecaIds: string[],
  destino: DestinoMover
): Promise<LoteGado> {
  const escolhidos = itens.filter((i) => i.quantidade > 0);
  if (escolhidos.length === 0) throw new Error("Escolha quantas cabeças vão sair do lote.");
  for (const i of escolhidos) {
    if (!Number.isInteger(i.quantidade)) throw new Error("A quantidade de cabeças deve ser um número inteiro.");
  }

  return db.transaction("rw", db.lotesGado, db.cabecas, db.partos, async () => {
    const origem = await loteGadoPorId(origemId);
    const abertos = await db.partos
      .where("loteGadoId")
      .equals(origemId)
      .filter((p) => !p.deletedAt && !p.desmamado)
      .toArray();
    const maximos = maximosMoviveis(origem.composicao, abertos);

    let compOrigem = origem.composicao;
    for (const i of escolhidos) {
      const idx = origem.composicao.findIndex((l) => l.sexo === i.sexo && l.categoria === i.categoria);
      const disponivel = idx >= 0 ? maximos[idx] : 0;
      if (i.quantidade > disponivel) {
        const segura = idx >= 0 && disponivel < origem.composicao[idx].quantidade;
        throw new Error(
          segura
            ? `${i.categoria}: só dá para mover ${disponivel}. O resto está com o bezerro mamando; use Desmamar.`
            : `O lote não tem ${i.quantidade} ${i.categoria.toLowerCase()}.`
        );
      }
      compOrigem = somar(compOrigem, i, -i.quantidade);
    }
    if (totalCabecas(compOrigem) === 0) {
      throw new Error("Para mover todas as cabeças, mova o lote inteiro para outro pasto ou exclua o lote.");
    }

    // Cabeças cadastradas que vão junto.
    const ids = Array.from(new Set(cabecaIds));
    const cabecas = [];
    for (const id of ids) {
      const c = await db.cabecas.get(id);
      if (!c || c.deletedAt || c.loteGadoId !== origemId) {
        throw new Error("Uma das cabeças escolhidas não está mais cadastrada neste lote.");
      }
      cabecas.push(c);
    }
    for (const sexo of ["Fêmea", "Macho"] as Sexo[]) {
      const saindo = escolhidos.filter((i) => i.sexo === sexo).reduce((s, i) => s + i.quantidade, 0);
      const marcadas = cabecas.filter((c) => c.sexo === sexo).length;
      if (marcadas > saindo) {
        throw new Error(
          `Você marcou ${marcadas} ${sexo === "Fêmea" ? "fêmeas" : "machos"} cadastrados, mas só vão sair ${saindo}. Aumente a quantidade ou desmarque.`
        );
      }
    }
    // As cabeças cadastradas que ficam precisam caber no lote de origem.
    const ficam = (await contarCabecas(origemId)) - cabecas.length;
    if (ficam > totalCabecas(compOrigem)) {
      throw new Error(
        "As cabeças cadastradas que ficam no lote passariam do total dele. Marque também as cadastradas que vão sair."
      );
    }

    const t = agora();
    let destinoLote: LoteGado;
    if (destino.tipo === "lote") {
      if (destino.loteId === origemId) throw new Error("Escolha um lote diferente do lote de origem.");
      const d = await loteGadoPorId(destino.loteId);
      let comp = d.composicao;
      for (const i of escolhidos) comp = somar(comp, i, i.quantidade);
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
        composicao: escolhidos.map((i) => ({ ...i })),
        raca: origem.raca,
        pesoMedioKg: null,
        origem: "",
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

    await db.lotesGado.update(origemId, { composicao: compOrigem, updatedAt: t, syncStatus: "pending" });
    for (const c of cabecas) {
      await db.cabecas.update(c.id, { loteGadoId: destinoLote.id, updatedAt: t, syncStatus: "pending" });
    }
    return destinoLote;
  });
}
