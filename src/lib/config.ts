// Configurações do produtor, guardadas no próprio aparelho (funcionam sem internet).

export const OPCOES_APAGAR_TAREFAS: { dias: number | null; rotulo: string }[] = [
  { dias: null, rotulo: "Nunca (eu apago)" },
  { dias: 7, rotulo: "Depois de 7 dias" },
  { dias: 30, rotulo: "Depois de 30 dias" },
  { dias: 90, rotulo: "Depois de 90 dias" },
  { dias: 180, rotulo: "Depois de 180 dias" },
];

const CHAVE = "cownter.config";

export interface Configuracao {
  /** Apagar sozinho as tarefas feitas depois de N dias (null = nunca). */
  apagarTarefasFeitasDias: number | null;
}

const PADRAO: Configuracao = { apagarTarefasFeitasDias: null };

export function lerConfiguracao(): Configuracao {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { ...PADRAO };
    const dados = JSON.parse(bruto) as Partial<Configuracao>;
    const dias = dados.apagarTarefasFeitasDias;
    return {
      apagarTarefasFeitasDias:
        typeof dias === "number" && OPCOES_APAGAR_TAREFAS.some((o) => o.dias === dias) ? dias : null,
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
