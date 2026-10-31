// Configurações do produtor, guardadas no próprio aparelho (funcionam sem internet).

export const OPCOES_APAGAR_TAREFAS: { dias: number | null; rotulo: string }[] = [
  { dias: null, rotulo: "Nunca (eu apago)" },
  { dias: 7, rotulo: "Depois de 7 dias" },
  { dias: 30, rotulo: "Depois de 30 dias" },
  { dias: 90, rotulo: "Depois de 90 dias" },
  { dias: 180, rotulo: "Depois de 180 dias" },
];

/** Idade (em meses) em que o bezerro deve ser desmamado; o produtor escolhe em Perfil. */
export const OPCOES_DESMAMA_MESES = [4, 5, 6, 7, 8, 9, 10] as const;
export const DESMAMA_MESES_PADRAO = 7;

/** Avisar quando o estoque (pelo consumo médio) deve acabar em até N dias. */
export const OPCOES_ESTOQUE_DIAS = [7, 10, 15, 20, 30, 45] as const;
export const ESTOQUE_DIAS_PADRAO = 15;

const CHAVE = "cownter.config";

export interface Configuracao {
  /** Apagar sozinho as tarefas feitas depois de N dias (null = nunca). */
  apagarTarefasFeitasDias: number | null;
  /** Com quantos meses o bezerro é desmamado (o app avisa quando chega a hora). */
  desmamaMeses: number;
  /** Avisar quando o estoque durar menos que N dias (pelo consumo médio). */
  estoqueDiasAviso: number;
}

const PADRAO: Configuracao = { apagarTarefasFeitasDias: null, desmamaMeses: DESMAMA_MESES_PADRAO, estoqueDiasAviso: ESTOQUE_DIAS_PADRAO };

export function lerConfiguracao(): Configuracao {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { ...PADRAO };
    const dados = JSON.parse(bruto) as Partial<Configuracao>;
    const dias = dados.apagarTarefasFeitasDias;
    return {
      apagarTarefasFeitasDias:
        typeof dias === "number" && OPCOES_APAGAR_TAREFAS.some((o) => o.dias === dias) ? dias : null,
      desmamaMeses:
        typeof dados.desmamaMeses === "number" &&
        (OPCOES_DESMAMA_MESES as readonly number[]).includes(dados.desmamaMeses)
          ? dados.desmamaMeses
          : DESMAMA_MESES_PADRAO,
      estoqueDiasAviso:
        typeof dados.estoqueDiasAviso === "number" &&
        (OPCOES_ESTOQUE_DIAS as readonly number[]).includes(dados.estoqueDiasAviso)
          ? dados.estoqueDiasAviso
          : ESTOQUE_DIAS_PADRAO,
    };
  } catch {
    return { ...PADRAO };
  }
}

export function salvarConfiguracao(parcial: Partial<Configuracao>): Configuracao {
  const nova = { ...lerConfiguracao(), ...parcial };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(nova));
  } catch {
    // sem armazenamento disponível: a configuração vale só até fechar o app
  }
  return nova;
}
