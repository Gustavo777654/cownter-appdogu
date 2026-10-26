import { db } from "./db";
import { criarCabeca, criarLoteGado } from "./gado";
import { criarNota, criarPasto, criarTarefa } from "./pastos";
import { addDias, addMeses } from "./rotinas";
import type { LoteGadoInput, Pasto } from "./types";
import { hoje } from "./utils";

const chave = (s: string) => s.trim().toLowerCase();

/**
 * Dados de exemplo para demonstração e testes: 3 pastos (um deles reservado,
 * descansando), rotinas com datas relativas a hoje (para já aparecerem alertas),
 * tarefas e 4 lotes de gado (um misto, um sem pasto e separado para venda).
 * Ignora o que já existe com o mesmo nome. Retorna quantos lotes de gado foram criados.
 */
export async function carregarDadosExemplo(): Promise<number> {
  const h = hoje();
  const dias = (n: number) => addDias(h, n)!;

  async function garantirPasto(
    nome: string,
    areaHa: number,
    nivel: Pasto["nivelPasto"],
    extra: Partial<Pasto>
  ): Promise<{ pasto: Pasto; novo: boolean }> {
    const existente = await db.pastos
      .filter((p) => !p.deletedAt && chave(p.nome) === chave(nome))
      .first();
    if (existente) return { pasto: existente, novo: false };
    const criado = await criarPasto({ nome, areaHa, nivelPasto: nivel });
    await db.pastos.update(criado.id, extra);
    return { pasto: { ...criado, ...extra }, novo: true };
  }

  const norte = await garantirPasto("Pasto Norte", 15.5, "Alto", {
    situacaoDesde: dias(-12),
    // remédio a cada 6 meses: a próxima aplicação cai daqui a 3 dias
    remedioUltimaData: addDias(addMeses(h, -6)!, 3)!,
    remedioIntervaloMeses: 6,
    // sal a cada 30 dias: passou 5 dias do prazo
    salUltimaData: dias(-35),
    salIntervaloDias: 30,
  });
  const sul = await garantirPasto("Pasto Sul", 12.3, "Médio", {
    situacaoDesde: dias(-40),
    remedioUltimaData: dias(-30),
    remedioIntervaloMeses: 6,
    salUltimaData: dias(-20),
    salIntervaloDias: 30,
  });
  await garantirPasto("Pasto do Brejo", 8, "Baixo", {
    situacao: "Reservado",
    situacaoDesde: dias(-25),
    nivelEm: dias(-25),
  });

  if (norte.novo) {
    await criarTarefa(norte.pasto.id, {
      titulo: "Arrumar a cerca do fundo",
      observacao: "Dois mourões caídos perto do açude.",
      prazo: dias(2),
    });
    await criarTarefa(norte.pasto.id, { titulo: "Jogar adubo", observacao: "", prazo: dias(-1) });
    await criarNota(norte.pasto.id, "Capim bem formado, boa rebrota depois da chuva.");
  }
  if (sul.novo) {
    await criarTarefa(sul.pasto.id, { titulo: "Roçar o pasto", observacao: "", prazo: "" });
  }

  const base = { raca: "", pesoMedioKg: null, origem: "" as const, vacinas: [], observacoes: "" };
  const lotes: LoteGadoInput[] = [
    {
      ...base,
      nome: "Matrizes do Norte",
      pastoId: norte.pasto.id,
      composicao: [
        { sexo: "Fêmea", categoria: "Vaca atrasada", quantidade: 12 },
        { sexo: "Fêmea", categoria: "Vaca mojando", quantidade: 4 },
        { sexo: "Fêmea", categoria: "Vaca parida", quantidade: 6 },
        { sexo: "Macho", categoria: "Touro", quantidade: 1 },
      ],
      raca: "Nelore",
      pesoMedioKg: 480,
      origem: "Nascido na fazenda",
      situacao: "Normal",
      vacinas: [
        { nome: "Aftosa", aplicada: true, faltam: null, data: dias(-60) },
        { nome: "Brucelose", aplicada: true, faltam: 3, data: dias(-45) },
      ],
    },
    {
      ...base,
      nome: "Garrotes",
      pastoId: sul.pasto.id,
      composicao: [{ sexo: "Macho", categoria: "Garrote", quantidade: 24 }],
      raca: "Nelore",
      pesoMedioKg: 310,
      origem: "Comprado",
      situacao: "Normal",
      vacinas: [{ nome: "Aftosa", aplicada: false, faltam: null, data: "" }],
    },
    {
      ...base,
      nome: "Novilhas",
      pastoId: sul.pasto.id,
      composicao: [
        { sexo: "Fêmea", categoria: "Novilha", quantidade: 15 },
        { sexo: "Fêmea", categoria: "Vitela", quantidade: 5 },
      ],
      raca: "Girolando",
      situacao: "Normal",
    },
    {
      ...base,
      nome: "Bois para venda",
      pastoId: null,
      composicao: [{ sexo: "Macho", categoria: "Boi", quantidade: 10 }],
      raca: "Brahman",
      pesoMedioKg: 520,
      situacao: "Separado para venda",
    },
  ];

  let criados = 0;
  for (const l of lotes) {
    try {
      const lote = await criarLoteGado(l);
      criados++;
      if (l.nome === "Matrizes do Norte") {
        await criarCabeca(lote.id, {
          brinco: "BR-001",
          cor: "Branca",
          nome: "Margarida",
          raca: "Nelore",
          sexo: "Fêmea",
          dataNascimento: "2021-05-15",
          pesoKg: 480,
          mae: "",
          pai: "",
          observacoes: "",
        });
        await criarCabeca(lote.id, {
          brinco: "",
          cor: "Preta com mancha na testa",
          nome: "",
          raca: "Angus",
          sexo: "Macho",
          dataNascimento: "",
          pesoKg: 650,
          mae: "",
          pai: "",
          observacoes: "Touro reprodutor.",
        });
      }
    } catch {
      // lote com esse nome já existe: segue para o próximo
    }
  }
  return criados;
}
