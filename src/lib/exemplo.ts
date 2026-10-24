import { criarAnimal } from "./animals";
import { db } from "./db";
import { criarLote, criarNota, criarTarefa } from "./lotes";
import { addDias, addMeses } from "./rotinas";
import type { AnimalInput, Lote } from "./types";
import { hoje } from "./utils";

const chave = (s: string) => s.trim().toLowerCase();

/**
 * Dados de exemplo para demonstração e testes: 3 pastos (um deles reservado,
 * descansando), rotinas com datas relativas a hoje (para já aparecerem alertas),
 * tarefas e um rebanho de 5 animais. Ignora o que já existe com o mesmo nome/brinco.
 * Retorna quantos animais foram criados.
 */
export async function carregarDadosExemplo(): Promise<number> {
  const h = hoje();
  const dias = (n: number) => addDias(h, n)!;

  async function garantirLote(
    nome: string,
    areaHa: number,
    nivel: Lote["nivelPasto"],
    extra: Partial<Lote>
  ): Promise<{ lote: Lote; novo: boolean }> {
    const existente = await db.lotes
      .filter((l) => !l.deletedAt && chave(l.nome) === chave(nome))
      .first();
    if (existente) return { lote: existente, novo: false };
    const criado = await criarLote({ nome, areaHa, nivelPasto: nivel });
    await db.lotes.update(criado.id, extra);
    return { lote: { ...criado, ...extra }, novo: true };
  }

  const norte = await garantirLote("Pasto Norte", 15.5, "Alto", {
    situacaoDesde: dias(-12),
    // remédio a cada 6 meses: a próxima aplicação cai daqui a 3 dias
    remedioUltimaData: addDias(addMeses(h, -6)!, 3)!,
    remedioIntervaloMeses: 6,
    // sal a cada 30 dias: passou 5 dias do prazo
    salUltimaData: dias(-35),
    salIntervaloDias: 30,
  });
  const sul = await garantirLote("Pasto Sul", 12.3, "Médio", {
    situacaoDesde: dias(-40),
    remedioUltimaData: dias(-30),
    remedioIntervaloMeses: 6,
    salUltimaData: dias(-20),
    salIntervaloDias: 30,
  });
  await garantirLote("Pasto do Brejo", 8, "Baixo", {
    situacao: "Reservado",
    situacaoDesde: dias(-25),
    nivelEm: dias(-25),
  });

  if (norte.novo) {
    await criarTarefa(norte.lote.id, {
      titulo: "Arrumar a cerca do fundo",
      observacao: "Dois mourões caídos perto do açude.",
      prazo: dias(2),
    });
    await criarTarefa(norte.lote.id, { titulo: "Jogar adubo", observacao: "", prazo: dias(-1) });
    await criarNota(norte.lote.id, "Capim bem formado, boa rebrota depois da chuva.");
  }
  if (sul.novo) {
    await criarTarefa(sul.lote.id, { titulo: "Roçar o pasto", observacao: "", prazo: "" });
  }

  const exemplos: AnimalInput[] = [
    {
      brinco: "BR-001",
      nome: "Margarida",
      raca: "Nelore",
      sexo: "Fêmea",
      dataNascimento: "2021-05-15",
      pesoKg: 480,
      mae: "Princesa Velha",
      pai: "Nelore Campeão",
      status: "Saudável",
      observacoes: "",
      loteId: norte.lote.id,
      vacinas: [
        { nome: "Aftosa", data: dias(-60) },
        { nome: "Raiva", data: dias(-60) },
      ],
    },
    {
      brinco: "BR-002",
      nome: "Zeus",
      raca: "Angus",
      sexo: "Macho",
      dataNascimento: "2023-03-20",
      pesoKg: 650,
      mae: "Rainha Angus",
      pai: "Zeus IV",
      status: "Saudável",
      observacoes: "Reprodutor.",
      loteId: sul.lote.id,
      vacinas: [{ nome: "Aftosa", data: dias(-45) }],
    },
    {
      brinco: "BR-003",
      nome: "Princesa",
      raca: "Nelore",
      sexo: "Fêmea",
      dataNascimento: "2024-02-10",
      pesoKg: 320,
      mae: "Margarida",
      pai: "Nelore Premium",
      status: "Vacinação pendente",
      observacoes: "",
      loteId: norte.lote.id,
      vacinas: [],
    },
    {
      brinco: "BR-004",
      nome: "Estrela",
      raca: "Girolando",
      sexo: "Fêmea",
      dataNascimento: "2022-09-02",
      pesoKg: 410,
      mae: "",
      pai: "",
      status: "Em tratamento",
      observacoes: "Em observação no curral de manejo.",
      loteId: sul.lote.id,
      vacinas: [{ nome: "Brucelose", data: "" }],
    },
    {
      brinco: "BR-005",
      nome: "",
      raca: "Brahman",
      sexo: "Macho",
      dataNascimento: "2025-01-12",
      pesoKg: 210,
      mae: "",
      pai: "",
      status: "Saudável",
      observacoes: "",
      loteId: null,
      vacinas: [],
    },
  ];

  let criados = 0;
  for (const ex of exemplos) {
    try {
      await criarAnimal(ex);
      criados++;
    } catch {
      // brinco já existente: segue para o próximo
    }
  }
  return criados;
}
